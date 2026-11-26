import { compareRegimes } from '../engine/compute.js';
import { DEDUCTION_CAPS } from '../engine/rules.js';
import { emptyInputs, TaxInputs } from '../engine/types.js';
import { FactField, FIELDS } from './fields.js';
import type { CaseFile, Fact, Flag, FlagState } from './types.js';

export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;
/** Cash deposits above this get a "confirm source" flag (unexplained credits: s.68/69) */
export const CASH_DEPOSIT_FLAG_THRESHOLD = 200_000;
/** Rent above this requires landlord PAN for an HRA claim (CBDT Circular 8/2013) */
export const RENT_PAN_THRESHOLD = 100_000;
/** Tolerance when comparing documents with AIS */
export const AIS_TOLERANCE = 1_000;

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const liveFacts = (facts: Fact[]) => facts.filter((f) => f.status !== 'rejected');

/** Resolve the value of one field from the non-rejected facts. */
export function fieldValue(facts: Fact[], field: FactField): number | boolean | string | undefined {
  const fs = liveFacts(facts).filter((f) => f.field === field);
  if (fs.length === 0) return undefined;
  const meta = FIELDS[field];
  if (meta.aggregate === 'sum' && meta.kind === 'amount') {
    return fs.reduce((s, f) => s + Number(f.value), 0);
  }
  // single: accepted beats proposed, then highest confidence
  const best = [...fs].sort(
    (a, b) => Number(b.status === 'accepted') - Number(a.status === 'accepted') || b.confidence - a.confidence,
  )[0];
  return best.value;
}

/** Fold reviewed facts into the engine's input shape. Rejected facts are ignored. */
export function buildInputs(facts: Fact[]): TaxInputs {
  const inputs = emptyInputs();
  for (const field of Object.keys(FIELDS) as FactField[]) {
    if (FIELDS[field].reconciliationOnly) continue;
    const v = fieldValue(facts, field);
    if (v === undefined) continue;
    const [head, key] = field.split('.') as [keyof TaxInputs, string];
    (inputs[head] as Record<string, unknown>)[key] = FIELDS[field].kind === 'boolean' ? Boolean(v) : v;
  }
  return inputs;
}

const num = (facts: Fact[], field: FactField) => {
  const v = fieldValue(facts, field);
  return typeof v === 'number' ? v : undefined;
};

/**
 * Deterministic reconciliation rules. They re-run on every change, so a flag
 * disappears on its own once the underlying data is fixed.
 */
export function ruleFlags(c: CaseFile): Flag[] {
  const facts = liveFacts(c.facts);
  const flags: Flag[] = [];
  const idsFor = (...fields: FactField[]) => facts.filter((f) => fields.includes(f.field)).map((f) => f.id);

  const rent = num(facts, 'salary.rentPaid') ?? 0;
  const hra = num(facts, 'salary.hraReceived') ?? 0;
  if (hra > 0 && rent > RENT_PAN_THRESHOLD && fieldValue(facts, 'recon.landlordPan') === undefined) {
    flags.push({
      id: 'rule:landlord-pan', source: 'rule', priority: 'high', amount: rent,
      title: `Landlord PAN missing for ${inr(rent)} rent`,
      detail: 'Annual rent above ₹1,00,000 requires the landlord\'s PAN for the HRA exemption (CBDT Circular 8/2013). Without it the employer-level exemption can be disallowed.',
      question: 'Please share your landlord\'s PAN and a copy of the rent agreement or receipts.',
      factIds: idsFor('salary.rentPaid'),
    });
  }

  const aisDeposit = num(facts, 'recon.aisDepositInterest');
  const docDeposit = num(facts, 'otherSources.depositInterest') ?? 0;
  if (aisDeposit !== undefined && Math.abs(aisDeposit - docDeposit) > AIS_TOLERANCE) {
    flags.push({
      id: 'rule:ais-deposit-interest', source: 'rule', priority: 'high', amount: aisDeposit - docDeposit,
      title: `AIS shows ${inr(aisDeposit)} deposit interest; documents show ${inr(docDeposit)}`,
      detail: 'Income reported in AIS but missing from the return is the most common trigger for a s.143(1)(a) adjustment notice.',
      question: 'AIS shows interest on fixed deposits we have no certificate for. Please share the FD interest certificate(s) for FY 2024-25.',
      factIds: idsFor('recon.aisDepositInterest', 'otherSources.depositInterest'),
    });
  }

  const aisSavings = num(facts, 'recon.aisSavingsInterest');
  const docSavings = num(facts, 'otherSources.savingsInterest') ?? 0;
  if (aisSavings !== undefined && Math.abs(aisSavings - docSavings) > AIS_TOLERANCE) {
    flags.push({
      id: 'rule:ais-savings-interest', source: 'rule', priority: 'medium', amount: aisSavings - docSavings,
      title: `Savings interest differs from AIS by ${inr(Math.abs(aisSavings - docSavings))}`,
      detail: `AIS reports ${inr(aisSavings)}; bank statements show ${inr(docSavings)}. Another savings account may be missing.`,
      question: 'Do you hold any other savings accounts? Please share statements for all accounts.',
      factIds: idsFor('recon.aisSavingsInterest', 'otherSources.savingsInterest'),
    });
  }

  const aisTds = num(facts, 'recon.aisTds');
  const docTds = num(facts, 'taxesPaid.tds') ?? 0;
  if (aisTds !== undefined && Math.abs(aisTds - docTds) > AIS_TOLERANCE) {
    flags.push({
      id: 'rule:ais-tds', source: 'rule', priority: aisTds > docTds ? 'medium' : 'high', amount: aisTds - docTds,
      title: `TDS per AIS ${inr(aisTds)} vs documents ${inr(docTds)}`,
      detail: aisTds > docTds
        ? 'Unclaimed TDS means a smaller refund. Likely TDS on income we have no certificate for.'
        : 'Claiming TDS not reflected in 26AS will be disallowed at processing.',
      question: 'Please share Form 16A / TDS certificates for all deductors listed in your AIS.',
      factIds: idsFor('recon.aisTds', 'taxesPaid.tds'),
    });
  }

  const c80 = num(facts, 'deductions.sec80C') ?? 0;
  if (c80 > DEDUCTION_CAPS.sec80C) {
    flags.push({
      id: 'rule:80c-over-cap', source: 'rule', priority: 'low', amount: c80 - DEDUCTION_CAPS.sec80C,
      title: `80C claims of ${inr(c80)} exceed the ₹1,50,000 cap`,
      detail: `${inr(c80 - DEDUCTION_CAPS.sec80C)} gives no tax benefit. Worth mentioning when planning next year's investments.`,
      question: 'No action needed. For next year, consider moving surplus 80C investments to NPS (80CCD(1B)).',
      factIds: idsFor('deductions.sec80C'),
    });
  }

  const cash = num(facts, 'recon.cashDeposits') ?? 0;
  if (cash >= CASH_DEPOSIT_FLAG_THRESHOLD) {
    flags.push({
      id: 'rule:cash-deposit', source: 'rule', priority: 'high', amount: cash,
      title: `Cash deposits of ${inr(cash)} need an explanation`,
      detail: 'Unexplained cash credits can be taxed u/s 68/69 at 60% + surcharge (s.115BBE). Large cash deposits are also reported to the department via SFT.',
      question: 'What was the source of the cash deposited during the year (e.g. gift, sale of asset, withdrawal redeposited)? Please share supporting evidence.',
      factIds: idsFor('recon.cashDeposits'),
    });
  }

  // Disagreements between documents on a single-valued field
  const byField = new Map<FactField, Fact[]>();
  for (const f of facts) {
    if (FIELDS[f.field].aggregate !== 'single') continue;
    byField.set(f.field, [...(byField.get(f.field) ?? []), f]);
  }
  for (const [field, fs] of byField) {
    const distinct = new Set(fs.map((f) => String(f.value)));
    if (distinct.size > 1) {
      flags.push({
        id: `conflict:${field}`, source: 'conflict', priority: 'medium',
        title: `Documents disagree on ${FIELDS[field].label.toLowerCase()}`,
        detail: `Values found: ${[...distinct].join(', ')}. The highest-confidence value is used until a reviewer picks one.`,
        question: 'Reviewer: accept the correct value and reject the others.',
        factIds: fs.map((f) => f.id),
      });
    }
  }

  return flags;
}

/** Facts the reviewer must look at: low confidence or unverifiable citation. */
export function qualityFlags(c: CaseFile): Flag[] {
  const flags: Flag[] = [];
  for (const f of c.facts) {
    if (f.status !== 'proposed') continue;
    const doc = c.documents.find((d) => d.id === f.docId);
    if (f.grounded === false) {
      flags.push({
        id: `grounding:${f.id}`, source: 'grounding', priority: 'high', docId: f.docId, factIds: [f.id],
        title: `Citation not found in ${doc?.name ?? 'document'}: ${FIELDS[f.field].label}`,
        detail: `The extractor quoted "${f.quote}", which does not appear verbatim in the document or does not contain the value. Treat as a possible hallucination.`,
        question: 'Reviewer: verify against the source document, then edit or reject.',
      });
    } else if (f.confidence < CONFIDENCE_REVIEW_THRESHOLD) {
      flags.push({
        id: `confidence:${f.id}`, source: 'confidence', priority: 'medium', docId: f.docId, factIds: [f.id],
        title: `Low confidence (${Math.round(f.confidence * 100)}%): ${f.label}`,
        detail: `Extracted as ${FIELDS[f.field].label} from ${doc?.name ?? 'document'}.`,
        question: 'Reviewer: confirm the classification and amount.',
      });
    }
  }
  return flags;
}

export interface FlagView extends Flag {
  state: FlagState['status'];
  note?: string;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function deriveFlags(c: CaseFile): FlagView[] {
  const all = [...ruleFlags(c), ...c.modelFlags, ...qualityFlags(c)];
  return all
    .map((f) => ({ ...f, state: c.flagState[f.id]?.status ?? 'open', note: c.flagState[f.id]?.note }))
    .sort((a, b) => Number(a.state !== 'open') - Number(b.state !== 'open') || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function caseSummary(c: CaseFile) {
  const inputs = buildInputs(c.facts);
  const comparison = compareRegimes(inputs);
  const flags = deriveFlags(c);
  return {
    inputs,
    comparison,
    flags,
    openFlags: flags.filter((f) => f.state === 'open'),
    pendingReview: c.facts.filter((f) => f.status === 'proposed').length,
    acceptedFacts: c.facts.filter((f) => f.status === 'accepted').length,
  };
}

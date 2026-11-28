import type { FactField } from '../../domain/fields.js';
import type { CaseDocument, DocKind } from '../../domain/types.js';
import type { Extractor, ExtractorRun } from './llmExtractor.js';
import type { ExtractionOutput } from './schema.js';

/**
 * Deterministic regex baseline. It exists for two reasons:
 *  1. Demo mode: the app works end-to-end with no API key.
 *  2. Evals: a baseline that shows what the LLM adds on documents that do not
 *     follow the expected template (see evals/).
 * It is intentionally simple — the kind of thing a firm already has in Excel macros.
 */

interface LineRule {
  field: FactField;
  match: RegExp;
  label: string;
  /** Only apply to these document kinds */
  kinds?: DocKind[];
  /** Skip lines that also match this */
  unless?: RegExp;
}

const RULES: LineRule[] = [
  { field: 'salary.gross', match: /section 17\(1\)/i, label: 'Gross salary u/s 17(1)', kinds: ['form16'] },
  { field: 'salary.basic', match: /basic salary/i, label: 'Basic salary', kinds: ['form16'] },
  { field: 'salary.hraReceived', match: /house rent allowance/i, unless: /10\(13a\)/i, label: 'HRA received', kinds: ['form16'] },
  { field: 'salary.professionalTax', match: /tax on employment|professional tax/i, label: 'Professional tax', kinds: ['form16'] },
  { field: 'salary.rentPaid', match: /rent (declared|paid)/i, label: 'Rent paid', kinds: ['form16', 'bank-statement', 'rent-receipt'] },
  { field: 'deductions.sec80C', match: /employee provident fund/i, label: 'Employee PF (80C)', kinds: ['form16'] },
  { field: 'taxesPaid.tds', match: /tax deducted at source/i, label: 'TDS u/s 192', kinds: ['form16'] },

  { field: 'houseProperty.letOutAnnualRent', match: /rent received/i, label: 'Rent received', kinds: ['bank-statement'] },
  { field: 'houseProperty.letOutMunicipalTax', match: /property tax|municipal tax/i, label: 'Municipal tax', kinds: ['bank-statement'] },
  { field: 'otherSources.savingsInterest', match: /total savings interest/i, label: 'Savings interest', kinds: ['bank-statement'] },
  { field: 'recon.cashDeposits', match: /total cash deposits/i, label: 'Cash deposits', kinds: ['bank-statement'] },

  { field: 'deductions.sec80C', match: /premium paid during/i, label: 'LIC premium (80C)', kinds: ['investment-proof'] },
  { field: 'deductions.sec80C', match: /total deposits in fy/i, label: 'PPF deposits (80C)', kinds: ['investment-proof'] },
  { field: 'deductions.sec80C', match: /principal repaid/i, label: 'Home-loan principal (80C)', kinds: ['loan-certificate'] },

  { field: 'capitalGains.stcg111A', match: /111a/i, label: 'STCG u/s 111A', kinds: ['capital-gains'] },
  { field: 'capitalGains.ltcg112A', match: /112a/i, label: 'LTCG u/s 112A', kinds: ['capital-gains'] },

  { field: 'business.netProfit', match: /net profit/i, label: 'Net profit (P&L)', kinds: ['business-financials'] },

  { field: 'recon.aisTds', match: /total tds reported/i, label: 'AIS total TDS', kinds: ['ais'] },
  { field: 'recon.aisSavingsInterest', match: /interest income - savings/i, label: 'AIS savings interest', kinds: ['ais'] },
  { field: 'recon.aisDepositInterest', match: /interest income - time deposit/i, label: 'AIS deposit interest', kinds: ['ais'] },
];

const KIND_HINTS: [DocKind, RegExp][] = [
  ['ais', /annual information statement|\bais\b|26as/i],
  ['form16', /form no\. 16|form 16/i],
  ['capital-gains', /capital gain|tax p&l/i],
  ['loan-certificate', /interest certificate|home ?loan/i],
  ['insurance', /80d|health insurance|mediclaim/i],
  ['bank-statement', /statement of account|bank statement/i],
  ['investment-proof', /provident fund|premium paid certificate|80c/i],
  ['rent-receipt', /rent receipt/i],
  ['business-financials', /profit and loss|profit & loss account|balance sheet/i],
  ['property-docs', /rent agreement|leave and licen[cs]e|property tax receipt/i],
];

export function detectKind(text: string): DocKind {
  return KIND_HINTS.find(([, re]) => re.test(text))?.[0] ?? 'other';
}

/** The rupee amount on a line: prefer "Rs."-prefixed numbers, else the last comma/decimal-formatted one. */
export function amountOnLine(line: string): number | null {
  const rs = [...line.matchAll(/(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => m[1]);
  const formatted = [...line.matchAll(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\b|\b\d+\.\d{2}\b/g)].map((m) => m[0]);
  const pick = rs.at(-1) ?? formatted.at(-1);
  if (!pick) return null;
  const n = Number(pick.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function rulesExtract(doc: Pick<CaseDocument, 'name' | 'text'>, kindHint?: DocKind): ExtractionOutput {
  const text = doc.text ?? '';
  const kind = kindHint && kindHint !== 'other' ? kindHint : detectKind(text);
  const lines = text.split('\n');
  const facts: ExtractionOutput['facts'] = [];
  const ambiguities: ExtractionOutput['ambiguities'] = [];

  for (const line of lines) {
    for (const rule of RULES) {
      if (rule.kinds && !rule.kinds.includes(kind)) continue;
      if (!rule.match.test(line) || rule.unless?.test(line)) continue;
      const amount = amountOnLine(line);
      if (amount === null || amount === 0) continue;
      facts.push({ field: rule.field, amount, text: null, label: rule.label, quote: line.trim(), page: 1, confidence: 0.9 });
      break; // one fact per line
    }
  }

  // Home-loan interest: let-out vs self-occupied depends on the property status line
  if (kind === 'loan-certificate') {
    const line = lines.find((l) => /interest paid during/i.test(l));
    const amount = line ? amountOnLine(line) : null;
    if (line && amount) {
      const letOut = /let ?out/i.test(text);
      facts.push({
        field: letOut ? 'houseProperty.letOutLoanInterest' : 'houseProperty.selfOccupiedLoanInterest',
        amount, text: null, label: `Home-loan interest (${letOut ? 'let-out' : 'self-occupied'})`, quote: line.trim(), page: 1, confidence: 0.85,
      });
    }
  }

  // Health insurance: attribute each premium to the most recent "Insured:" line
  if (kind === 'insurance') {
    let insured = '';
    for (const line of lines) {
      if (/insured:/i.test(line)) insured = line;
      if (!/premium paid/i.test(line)) continue;
      const amount = amountOnLine(line);
      if (!amount) continue;
      const ages = [...insured.matchAll(/age (\d{2})/gi)].map((m) => Number(m[1]));
      const parents = /father|mother|parent|senior/i.test(insured) || ages.some((a) => a >= 60);
      facts.push({
        field: parents ? 'deductions.sec80D_parents' : 'deductions.sec80D_self',
        amount, text: null, label: parents ? 'Health insurance — parents' : 'Health insurance — self/family', quote: line.trim(), page: 1, confidence: 0.85,
      });
      if (parents && ages.some((a) => a >= 60)) {
        facts.push({ field: 'deductions.parentsSenior', amount: 1, text: null, label: 'Parent aged 60+', quote: insured.trim(), page: 1, confidence: 0.85 });
      }
    }
  }

  const pan = text.match(/landlord pan:\s*([A-Z]{5}\d{4}[A-Z])/i);
  if (pan) facts.push({ field: 'recon.landlordPan', amount: null, text: pan[1], label: 'Landlord PAN', quote: pan[0], page: 1, confidence: 0.9 });

  const coaching = lines.find((l) => /coaching|tuition/i.test(l));
  if (coaching) {
    ambiguities.push({
      description: 'Coaching / tuition payment found; only school or college tuition for children qualifies under 80C',
      question: 'Who was this coaching fee for, and is it a school/college fee or private coaching?',
      priority: 'medium', amount: amountOnLine(coaching), quote: coaching.trim(),
    });
  }

  return { documentType: kind, summary: `${kind} (rules baseline)`, facts, ambiguities };
}

export class RulesExtractor implements Extractor {
  readonly id = 'rules:v1';
  async extract(doc: Pick<CaseDocument, 'name' | 'text' | 'base64' | 'mimeType'>): Promise<ExtractorRun> {
    const started = performance.now();
    if (!doc.text) {
      throw new Error('The rules baseline can only read text. Switch to live AI mode to extract PDFs and images.');
    }
    const output = rulesExtract(doc);
    return { output, extractor: this.id, latencyMs: Math.round(performance.now() - started) };
  }
}

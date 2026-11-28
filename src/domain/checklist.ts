/**
 * Document checklist: which documents a client owes, given their profile, and how far
 * each one has got. Pure and shared by the browser, the server (list summaries) and tests.
 *
 * Status of one requirement:
 *   missing  — fewer documents than required (e.g. 1 of 2 Form 16s)
 *   received — in, but extraction hasn't finished
 *   issue    — in, but extraction failed or a high-priority flag points at it
 *   ok       — in, extracted, nothing blocking
 */
import { deriveFlags } from './caseFile.js';
import type { CaseFile, ClientProfile, DocKind } from './types.js';

export type CaseStatusLike = 'draft' | 'in_review' | 'final';

export interface Requirement {
  id: string;
  kind: DocKind;
  label: string;
  /** Why the CA needs it, in one line the client can understand */
  why: string;
  minCount: number;
  /** Optional items are listed but never block readiness */
  optional?: boolean;
}

export type ItemStatus = 'missing' | 'received' | 'issue' | 'ok';

export interface ChecklistItem extends Requirement {
  status: ItemStatus;
  count: number;
  docIds: string[];
  /** e.g. "1 of 2 received", "extraction failed" */
  note?: string;
}

export type Stage = 'not-started' | 'awaiting-docs' | 'needs-review' | 'ready' | 'filed';

export const STAGE_LABEL: Record<Stage, string> = {
  'not-started': 'Not started',
  'awaiting-docs': 'Awaiting documents',
  'needs-review': 'Needs review',
  ready: 'Ready to file',
  filed: 'Filed',
};

/** Serializable result, stored with the case on the server and used by the dashboard */
export interface ChecklistSummary {
  items: Pick<ChecklistItem, 'id' | 'kind' | 'label' | 'why' | 'status' | 'count' | 'minCount' | 'optional' | 'note'>[];
  stage: Stage;
  /** 0–100. Documents are 70%, review 30%. Only "ready" and "filed" reach 100. */
  readyPct: number;
  pendingFacts: number;
  openHighFlags: number;
  nextAction: string;
  phone?: string;
}

export interface Checklist extends ChecklistSummary {
  items: ChecklistItem[];
  profile: ClientProfile;
  /** true when the profile was guessed from the documents (cases saved before M2) */
  profileInferred: boolean;
}

export const EMPTY_PROFILE: ClientProfile = {
  salaried: false, employers: 0, paysRent: false, homeLoan: false, educationLoan: false, rentalIncome: false,
  capitalGains: false, business: false, investments80C: false, healthInsurance: false,
};

/** The documents a client with this profile must send. */
export function requirements(p: ClientProfile): Requirement[] {
  const r: Requirement[] = [];
  if (p.salaried) {
    const n = Math.max(1, p.employers);
    r.push({
      id: 'form16', kind: 'form16', minCount: n,
      label: n > 1 ? `Form 16 from each employer (${n})` : 'Form 16 from employer',
      why: 'Salary, exemptions and tax already deducted by the employer',
    });
  }
  if (p.business) r.push({ id: 'business', kind: 'business-financials', minCount: 1, label: 'Business P&L and balance sheet', why: 'Business or professional income' });
  if (p.capitalGains) r.push({ id: 'capital-gains', kind: 'capital-gains', minCount: 1, label: 'Capital-gains statement from broker', why: 'Gains on shares and mutual funds sold during the year' });
  if (p.paysRent) r.push({ id: 'rent', kind: 'rent-receipt', minCount: 1, label: 'Rent receipts (with landlord PAN)', why: 'HRA exemption; landlord PAN is needed if rent is over ₹1 lakh a year' });
  const loans = Number(p.homeLoan) + Number(p.educationLoan);
  if (loans) {
    r.push({
      id: 'loans', kind: 'loan-certificate', minCount: loans,
      label: p.homeLoan && p.educationLoan ? 'Loan interest certificates (home and education)' : p.homeLoan ? 'Home-loan interest certificate' : 'Education-loan interest certificate',
      why: p.homeLoan ? 'Interest and principal deductions on the home loan' : 'Section 80E deduction on education-loan interest',
    });
  }
  if (p.investments80C) r.push({ id: '80c', kind: 'investment-proof', minCount: 1, label: '80C investment proofs (LIC, PPF, ELSS…)', why: 'Deductions under section 80C, if the old regime works out cheaper' });
  if (p.healthInsurance) r.push({ id: '80d', kind: 'insurance', minCount: 1, label: 'Health-insurance premium receipts', why: 'Deduction under section 80D' });
  r.push({ id: 'bank', kind: 'bank-statement', minCount: 1, label: 'Bank statements for the year', why: 'Interest income and large deposits the department can see' });
  r.push({ id: 'ais', kind: 'ais', minCount: 1, label: 'AIS / Form 26AS', why: 'What the department already knows, to reconcile before filing' });
  if (p.rentalIncome) r.push({ id: 'property', kind: 'property-docs', minCount: 1, optional: true, label: 'Rent agreement and property-tax receipt', why: 'Supports rent received and municipal tax on a let-out property' });
  return r;
}

/** Best guess at a profile for a case saved before profiles existed. */
export function inferProfile(c: CaseFile): ClientProfile {
  const kinds = c.documents.map((d) => d.kind);
  const has = (k: DocKind) => kinds.includes(k);
  const fact = (prefix: string) => c.facts.some((f) => f.status !== 'rejected' && f.field.startsWith(prefix));
  const form16s = kinds.filter((k) => k === 'form16').length;
  return {
    salaried: form16s > 0 || fact('salary.gross'),
    employers: Math.max(form16s, fact('salary.gross') ? 1 : 0),
    paysRent: has('rent-receipt') || fact('salary.rentPaid'),
    homeLoan: c.facts.some((f) => f.field.startsWith('houseProperty.') && f.field.endsWith('LoanInterest')),
    educationLoan: fact('deductions.sec80E'),
    rentalIncome: fact('houseProperty.letOutAnnualRent'),
    capitalGains: has('capital-gains') || fact('capitalGains.'),
    business: has('business-financials') || fact('business.'),
    investments80C: has('investment-proof'),
    healthInsurance: has('insurance') || fact('deductions.sec80D'),
  };
}

export function evaluateChecklist(c: CaseFile, status?: CaseStatusLike): Checklist {
  const profileInferred = !c.profile;
  const profile = c.profile ?? inferProfile(c);
  const flags = deriveFlags(c).filter((f) => f.state === 'open');
  const highFlags = flags.filter((f) => f.priority === 'high');
  const factDoc = new Map(c.facts.map((f) => [f.id, f.docId]));
  const flaggedDocs = new Set<string>();
  for (const f of highFlags) {
    if (f.docId) flaggedDocs.add(f.docId);
    for (const id of f.factIds ?? []) { const d = factDoc.get(id); if (d) flaggedDocs.add(d); }
  }

  const items: ChecklistItem[] = requirements(profile).map((req) => {
    const docs = c.documents.filter((d) => d.kind === req.kind);
    const docIds = docs.map((d) => d.id);
    const count = docs.length;
    if (count < req.minCount) {
      return { ...req, status: 'missing', count, docIds, note: count ? `${count} of ${req.minCount} received` : undefined };
    }
    if (docs.some((d) => d.status === 'error')) return { ...req, status: 'issue', count, docIds, note: 'Could not be read; ask for a clearer copy' };
    if (docs.some((d) => d.status === 'queued' || d.status === 'extracting')) return { ...req, status: 'received', count, docIds, note: 'Being read' };
    if (docs.some((d) => flaggedDocs.has(d.id))) return { ...req, status: 'issue', count, docIds, note: 'Has a high-priority question' };
    return { ...req, status: 'ok', count, docIds };
  });

  const pendingFacts = c.facts.filter((f) => f.status === 'proposed').length;
  const reviewed = c.facts.filter((f) => f.status !== 'proposed').length;
  const mandatory = items.filter((i) => !i.optional);
  const missing = mandatory.filter((i) => i.status === 'missing');
  const docScore = mandatory.length
    ? mandatory.reduce((s, i) => s + (i.status === 'ok' ? 1 : i.status === 'missing' ? Math.min(i.count / i.minCount, 1) * 0.5 : 0.5), 0) / mandatory.length
    : 1;
  const reviewScore = c.facts.length ? reviewed / c.facts.length : 0;

  let stage: Stage;
  if (status === 'final') stage = 'filed';
  else if (c.documents.length === 0) stage = 'not-started';
  else if (missing.length) stage = 'awaiting-docs';
  else if (pendingFacts || highFlags.length || mandatory.some((i) => i.status !== 'ok')) stage = 'needs-review';
  else stage = 'ready';

  const readyPct = stage === 'filed' || stage === 'ready' ? 100 : Math.min(95, Math.round(70 * docScore + 30 * reviewScore));

  const nextAction =
    stage === 'filed' ? 'Filed and locked'
    : stage === 'not-started' ? `Request ${mandatory.length} documents from the client`
    : stage === 'awaiting-docs' ? `Chase ${missing.length} missing document${missing.length > 1 ? 's' : ''}: ${missing.map((m) => shortLabel(m) + (m.count ? ` (${m.count} of ${m.minCount})` : '')).join(', ')}`
    : pendingFacts ? `Review ${pendingFacts} extracted figure${pendingFacts > 1 ? 's' : ''}`
    : highFlags.length ? `Resolve ${highFlags.length} high-priority question${highFlags.length > 1 ? 's' : ''}`
    : mandatory.some((i) => i.status !== 'ok') ? 'Fix documents that could not be read'
    : 'Ready for partner sign-off';

  return { items, profile, profileInferred, stage, readyPct, pendingFacts, openHighFlags: highFlags.length, nextAction, phone: c.client.phone || undefined };
}

/** What gets stored and sent to the dashboard: no document ids, nothing beyond labels and counts. */
export function summarizeChecklist(ch: Checklist): ChecklistSummary {
  return {
    items: ch.items.map(({ id, kind, label, why, status, count, minCount, optional, note }) => ({ id, kind, label, why, status, count, minCount, optional, note })),
    stage: ch.stage, readyPct: ch.readyPct, pendingFacts: ch.pendingFacts, openHighFlags: ch.openHighFlags, nextAction: ch.nextAction, phone: ch.phone,
  };
}

/** A stored summary predates the latest status change; status is authoritative for "filed". */
export function applyStatus(s: ChecklistSummary, status: CaseStatusLike | null | undefined): ChecklistSummary {
  if (status === 'final') return { ...s, stage: 'filed', readyPct: 100, nextAction: 'Filed and locked' };
  if (s.stage === 'filed') return { ...s, stage: 'needs-review', readyPct: 95, nextAction: 'Reopened: review before filing again' };
  return s;
}

const shortLabel = (i: Pick<ChecklistItem, 'kind' | 'label'>) => (i.kind === 'form16' ? 'Form 16' : i.label.replace(/\s*\(.*\)$/, ''));

/** The message a CA sends: names only what is still missing, with the reason for each. */
export function reminderMessage(opts: { clientName: string; fy: string; firmName?: string; items: ChecklistSummary['items'] }): string {
  const missing = opts.items.filter((i) => i.status === 'missing' && !i.optional);
  const unreadable = opts.items.filter((i) => i.status === 'issue' && i.note?.startsWith('Could not be read'));
  const first = opts.clientName.trim().split(/\s+/)[0] || 'there';
  if (!missing.length && !unreadable.length) {
    return `Hi ${first}, we have everything we need for your FY ${opts.fy} return. We'll be in touch once it's ready for you to review.${opts.firmName ? `\n\n— ${opts.firmName}` : ''}`;
  }
  const lines = [
    ...missing.map((i) => `• ${i.label}${i.note ? ` (${i.note})` : ''}`),
    ...unreadable.map((i) => `• ${i.label} (the copy we have can't be read, please resend)`),
  ];
  return [
    `Hi ${first}, to file your income-tax return for FY ${opts.fy} we still need:`,
    '',
    ...lines,
    '',
    'You can reply here with photos or PDFs. Thank you!',
    ...(opts.firmName ? ['', `— ${opts.firmName}`] : []),
  ].join('\n');
}

/**
 * wa.me link that opens WhatsApp with the message ready to send from the CA's own number.
 * A 10-digit number is treated as Indian (+91). With no number, WhatsApp asks whom to send it to.
 */
export function whatsappLink(phone: string | undefined, text: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

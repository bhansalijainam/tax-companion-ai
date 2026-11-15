/**
 * The catalogue of facts the extractor may produce. This is the contract between
 * the LLM and the deterministic engine: the model can only emit these fields, and
 * each field maps to exactly one place in TaxInputs (or to reconciliation-only data).
 */

export type FactValueKind = 'amount' | 'boolean' | 'text';

export interface FieldMeta {
  label: string;
  kind: FactValueKind;
  /** sum: several facts add up (e.g. 80C items). single: one true value; disagreement is a conflict. */
  aggregate: 'sum' | 'single';
  /** Guidance shown to the model in the extraction prompt */
  hint: string;
  /** Reconciliation-only facts are not fed to the tax engine */
  reconciliationOnly?: boolean;
}

const FIELD_DEFS = {
  'salary.gross': { label: 'Gross salary', kind: 'amount', aggregate: 'single', hint: 'Gross salary u/s 17(1) incl. allowances, before exemptions (Form 16 Part B).' },
  'salary.basic': { label: 'Basic salary + DA', kind: 'amount', aggregate: 'single', hint: 'Annual basic pay plus dearness allowance.' },
  'salary.hraReceived': { label: 'HRA received', kind: 'amount', aggregate: 'single', hint: 'Annual house rent allowance received from employer.' },
  'salary.professionalTax': { label: 'Professional tax', kind: 'amount', aggregate: 'single', hint: 'Professional tax deducted u/s 16(iii).' },
  'salary.rentPaid': { label: 'Rent paid (own residence)', kind: 'amount', aggregate: 'single', hint: 'Total annual rent the taxpayer paid for the home they live in. Never rent the taxpayer received.' },
  'salary.metro': { label: 'Lives in a metro (HRA 50%)', kind: 'boolean', aggregate: 'single', hint: 'true only if the rented home is in Delhi, Mumbai, Kolkata or Chennai. Bengaluru, Pune, Hyderabad are non-metro for HRA.' },

  'houseProperty.letOutAnnualRent': { label: 'Rent received (let-out property)', kind: 'amount', aggregate: 'sum', hint: 'Annual rent the taxpayer received from tenants.' },
  'houseProperty.letOutMunicipalTax': { label: 'Municipal tax paid (let-out)', kind: 'amount', aggregate: 'sum', hint: 'Property / municipal tax paid on the let-out property.' },
  'houseProperty.letOutLoanInterest': { label: 'Home-loan interest (let-out)', kind: 'amount', aggregate: 'sum', hint: 'Interest component of a housing loan on a let-out property.' },
  'houseProperty.selfOccupiedLoanInterest': { label: 'Home-loan interest (self-occupied)', kind: 'amount', aggregate: 'sum', hint: 'Interest on a housing loan for a home the taxpayer lives in.' },

  'otherSources.savingsInterest': { label: 'Savings-account interest', kind: 'amount', aggregate: 'sum', hint: 'Total interest credited to savings accounts in the year.' },
  'otherSources.depositInterest': { label: 'FD / RD interest', kind: 'amount', aggregate: 'sum', hint: 'Interest on fixed or recurring deposits, per certificate. Not from AIS.' },
  'otherSources.other': { label: 'Other income', kind: 'amount', aggregate: 'sum', hint: 'Dividends or other income from other sources.' },

  'capitalGains.stcg111A': { label: 'STCG on listed equity (s.111A)', kind: 'amount', aggregate: 'sum', hint: 'Net short-term gains on listed shares / equity funds.' },
  'capitalGains.ltcg112A': { label: 'LTCG on listed equity (s.112A)', kind: 'amount', aggregate: 'sum', hint: 'Net long-term gains on listed shares / equity funds, before the ₹1.25L exemption.' },

  'business.netProfit': { label: 'Business / professional profit', kind: 'amount', aggregate: 'sum', hint: 'Net profit from business or profession.' },

  'deductions.sec80C': { label: '80C investment', kind: 'amount', aggregate: 'sum', hint: 'One fact per 80C item: EPF, PPF, LIC premium, ELSS, home-loan principal, children\'s school tuition. Coaching classes do NOT qualify.' },
  'deductions.sec80CCD1B': { label: 'NPS contribution (80CCD(1B))', kind: 'amount', aggregate: 'sum', hint: 'Voluntary NPS Tier-I contribution by the employee.' },
  'deductions.sec80D_self': { label: 'Health insurance — self/family', kind: 'amount', aggregate: 'sum', hint: 'Premium for self, spouse, children.' },
  'deductions.sec80D_parents': { label: 'Health insurance — parents', kind: 'amount', aggregate: 'sum', hint: 'Premium paid for parents.' },
  'deductions.parentsSenior': { label: 'Parents are 60+', kind: 'boolean', aggregate: 'single', hint: 'true if an insured parent is 60 or older.' },
  'deductions.sec80E': { label: 'Education-loan interest', kind: 'amount', aggregate: 'sum', hint: 'Interest on a loan for higher education.' },
  'deductions.sec80G': { label: 'Donations (qualifying)', kind: 'amount', aggregate: 'sum', hint: 'Qualifying amount of donations to approved funds.' },

  'taxesPaid.tds': { label: 'TDS', kind: 'amount', aggregate: 'sum', hint: 'Tax deducted at source per Form 16 / 16A. Not from AIS.' },
  'taxesPaid.advanceTax': { label: 'Advance / self-assessment tax', kind: 'amount', aggregate: 'sum', hint: 'Challan payments.' },

  'recon.landlordPan': { label: 'Landlord PAN', kind: 'text', aggregate: 'single', hint: 'PAN of the landlord the taxpayer pays rent to.', reconciliationOnly: true },
  'recon.cashDeposits': { label: 'Cash deposits', kind: 'amount', aggregate: 'sum', hint: 'Cash deposited into bank accounts.', reconciliationOnly: true },
  'recon.aisDepositInterest': { label: 'AIS: deposit interest', kind: 'amount', aggregate: 'single', hint: 'Interest on deposits as reported in AIS / 26AS.', reconciliationOnly: true },
  'recon.aisSavingsInterest': { label: 'AIS: savings interest', kind: 'amount', aggregate: 'single', hint: 'Savings interest as reported in AIS / 26AS.', reconciliationOnly: true },
  'recon.aisTds': { label: 'AIS: total TDS', kind: 'amount', aggregate: 'single', hint: 'Total TDS as reported in AIS / 26AS.', reconciliationOnly: true },
} as const satisfies Record<string, FieldMeta>;

export type FactField = keyof typeof FIELD_DEFS;
export const FIELDS: Record<FactField, FieldMeta> = FIELD_DEFS;
export const FACT_FIELDS = Object.keys(FIELDS) as FactField[];

export function fieldMeta(field: FactField): FieldMeta {
  return FIELDS[field];
}

export function isFactField(v: unknown): v is FactField {
  return typeof v === 'string' && v in FIELDS;
}

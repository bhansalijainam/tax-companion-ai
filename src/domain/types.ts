import type { FactField } from './fields.js';

export type DocKind =
  | 'form16'
  | 'bank-statement'
  | 'investment-proof'
  | 'insurance'
  | 'loan-certificate'
  | 'capital-gains'
  | 'ais'
  | 'rent-receipt'
  | 'business-financials'
  | 'property-docs'
  | 'other';

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  form16: 'Form 16',
  'bank-statement': 'Bank statement',
  'investment-proof': 'Investment proof',
  insurance: 'Insurance receipt',
  'loan-certificate': 'Loan certificate',
  'capital-gains': 'Capital-gains statement',
  ais: 'AIS / 26AS',
  'rent-receipt': 'Rent receipt',
  'business-financials': 'Business P&L / books',
  'property-docs': 'Property documents',
  other: 'Other',
};

/** Every document kind, in display order. Single source for schemas and validators. */
export const DOC_KINDS = Object.keys(DOC_KIND_LABEL) as DocKind[];

/**
 * What the client's year looks like. Drives which documents are required (see checklist.ts).
 * Stored per case, because income sources change from year to year.
 */
export interface ClientProfile {
  salaried: boolean;
  /** Employers during the year; one Form 16 is expected from each */
  employers: number;
  paysRent: boolean;
  homeLoan: boolean;
  educationLoan: boolean;
  rentalIncome: boolean;
  capitalGains: boolean;
  business: boolean;
  investments80C: boolean;
  healthInsurance: boolean;
}

export interface CaseDocument {
  id: string;
  name: string;
  kind: DocKind;
  mimeType: string;
  size: number;
  /** Plain text when available (text files, sample docs). PDFs/images are sent to the model as-is. */
  text?: string;
  /** base64 payload for binary uploads (live mode only) */
  base64?: string;
  status: 'queued' | 'extracting' | 'extracted' | 'error';
  error?: string;
  extractor?: string;
  latencyMs?: number;
  summary?: string;
}

export type FactOrigin = 'llm' | 'rules' | 'human';
export type FactStatus = 'proposed' | 'accepted' | 'rejected';

export interface Fact {
  id: string;
  docId: string;
  field: FactField;
  value: number | boolean | string;
  /** What the extractor called this line item, e.g. "LIC premium — policy 8812" */
  label: string;
  /** Verbatim text from the document supporting the value */
  quote: string;
  page?: number;
  confidence: number;
  origin: FactOrigin;
  status: FactStatus;
  /**
   * true  = quote found verbatim in the document text and contains the value
   * false = quote not found / value not in quote (possible hallucination)
   * null  = cannot verify (binary document without text layer)
   */
  grounded: boolean | null;
  /** Value before a human edit, for the audit trail */
  originalValue?: number | boolean | string;
}

export type FlagPriority = 'high' | 'medium' | 'low';
export type FlagSource = 'rule' | 'model' | 'confidence' | 'grounding' | 'conflict';

export interface Flag {
  id: string;
  source: FlagSource;
  title: string;
  detail: string;
  /** Question the CA can forward to the client */
  question: string;
  priority: FlagPriority;
  factIds?: string[];
  docId?: string;
  /** Rupee amount at stake, when known */
  amount?: number;
}

export interface FlagState {
  status: 'open' | 'resolved' | 'dismissed';
  note?: string;
  at: string;
}

export interface AuditEvent {
  at: string;
  actor: 'system' | 'ai' | 'ca';
  action: string;
  detail: string;
}

export interface CaseFile {
  client: {
    name: string; pan: string; fy: string; ay: string; employer?: string;
    /** For reminders. Consent capture arrives with WhatsApp sending (M4). */
    phone?: string;
    email?: string;
  };
  /** Absent on cases saved before M2; inferProfile() fills the gap from the documents */
  profile?: ClientProfile;
  documents: CaseDocument[];
  facts: Fact[];
  /** Ambiguities raised by the model during extraction */
  modelFlags: Flag[];
  flagState: Record<string, FlagState>;
  audit: AuditEvent[];
}

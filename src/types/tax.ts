export interface Client {
  id: string;
  name: string;
  financialYear: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
}

export interface Document {
  id: string;
  name: string;
  type: 'form16' | 'bank-statement' | 'gst-return' | 'investment-proof' | 'expense-sheet' | 'other';
  status: 'uploaded' | 'processing' | 'extracted' | 'error';
  uploadedAt: Date;
  size: number;
}

export interface IncomeEntry {
  id: string;
  source: string;
  type: 'salary' | 'rental' | 'capital-gains-short' | 'capital-gains-long' | 'business' | 'interest' | 'other';
  amount: number;
  documentRef: string;
  confidence: number;
}

export interface ExpenseEntry {
  id: string;
  description: string;
  category: string;
  taxSection: string | null;
  deductible: boolean;
  amount: number;
  date: string;
  documentRef: string;
  confidence: number;
}

export interface InvestmentEntry {
  id: string;
  type: string;
  section: '80C' | '80CCD' | '80D' | '80G' | '80E' | 'other';
  amount: number;
  limit: number;
  documentRef: string;
  confidence: number;
}

export interface FlaggedItem {
  id: string;
  itemDescription: string;
  reason: string;
  question: string;
  priority: 'high' | 'medium' | 'low';
  category: 'missing-doc' | 'unclear-expense' | 'inconsistency' | 'verification-needed';
  resolved: boolean;
}

export interface TaxCalculation {
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  taxOldRegime: number;
  taxNewRegime: number;
  recommendedRegime: 'old' | 'new';
  savings: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AnalysisState {
  client: Client | null;
  documents: Document[];
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  investments: InvestmentEntry[];
  flags: FlaggedItem[];
  taxCalculation: TaxCalculation | null;
  chatMessages: ChatMessage[];
}

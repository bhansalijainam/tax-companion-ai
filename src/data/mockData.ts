import { AnalysisState, Client, Document, IncomeEntry, ExpenseEntry, InvestmentEntry, FlaggedItem, TaxCalculation } from '@/types/tax';

export const mockClient: Client = {
  id: '1',
  name: 'Rahul Sharma',
  financialYear: '2024-25',
  status: 'in-progress',
  createdAt: new Date('2024-01-15'),
};

export const mockDocuments: Document[] = [
  { id: '1', name: 'Form16_2024.pdf', type: 'form16', status: 'extracted', uploadedAt: new Date(), size: 245000 },
  { id: '2', name: 'HDFC_Statement_Q4.pdf', type: 'bank-statement', status: 'extracted', uploadedAt: new Date(), size: 1200000 },
  { id: '3', name: 'LIC_Premium_Receipt.pdf', type: 'investment-proof', status: 'extracted', uploadedAt: new Date(), size: 89000 },
  { id: '4', name: 'PPF_Passbook.pdf', type: 'investment-proof', status: 'extracted', uploadedAt: new Date(), size: 156000 },
];

export const mockIncome: IncomeEntry[] = [
  { id: '1', source: 'ABC Technologies Pvt Ltd', type: 'salary', amount: 1200000, documentRef: 'Form16_2024.pdf', confidence: 0.98 },
  { id: '2', source: 'HDFC Savings Account', type: 'interest', amount: 15000, documentRef: 'HDFC_Statement_Q4.pdf', confidence: 0.95 },
  { id: '3', source: 'Flat Rent - Andheri', type: 'rental', amount: 360000, documentRef: 'Bank Statement', confidence: 0.92 },
];

export const mockExpenses: ExpenseEntry[] = [
  { id: '1', description: 'Office Rent - Commercial Space', category: 'Business Expense', taxSection: 'Section 30', deductible: true, amount: 180000, date: '2024-04-01', documentRef: 'Expense_Sheet.xlsx', confidence: 0.94 },
  { id: '2', description: 'Employee Salaries', category: 'Business Expense', taxSection: 'Section 37', deductible: true, amount: 450000, date: '2024-06-30', documentRef: 'Expense_Sheet.xlsx', confidence: 0.97 },
  { id: '3', description: 'ABC Coaching Classes', category: 'Education', taxSection: null, deductible: false, amount: 45000, date: '2024-08-15', documentRef: 'HDFC_Statement_Q4.pdf', confidence: 0.72 },
  { id: '4', description: 'Vehicle Purchase - Honda City', category: 'Capital Asset', taxSection: 'Depreciation', deductible: true, amount: 850000, date: '2024-09-20', documentRef: 'Expense_Sheet.xlsx', confidence: 0.89 },
  { id: '5', description: 'Director Personal Expense', category: 'Personal', taxSection: null, deductible: false, amount: 25000, date: '2024-10-05', documentRef: 'Bank Statement', confidence: 0.85 },
];

export const mockInvestments: InvestmentEntry[] = [
  { id: '1', type: 'LIC Premium', section: '80C', amount: 50000, limit: 150000, documentRef: 'LIC_Premium_Receipt.pdf', confidence: 0.99 },
  { id: '2', type: 'PPF Contribution', section: '80C', amount: 100000, limit: 150000, documentRef: 'PPF_Passbook.pdf', confidence: 0.98 },
  { id: '3', type: 'Health Insurance Premium', section: '80D', amount: 25000, limit: 25000, documentRef: 'HDFC_Statement_Q4.pdf', confidence: 0.94 },
  { id: '4', type: 'NPS Contribution', section: '80CCD', amount: 50000, limit: 50000, documentRef: 'Bank Statement', confidence: 0.91 },
];

export const mockFlags: FlaggedItem[] = [
  {
    id: '1',
    itemDescription: 'HRA Claim - ₹2,40,000',
    reason: 'Rent receipt documentation missing for HRA claim',
    question: 'Please provide rent receipts or rental agreement for the claimed HRA of ₹2,40,000',
    priority: 'high',
    category: 'missing-doc',
    resolved: false,
  },
  {
    id: '2',
    itemDescription: 'ABC Coaching Classes - ₹45,000',
    reason: 'Unable to determine if this is educational expense for self/dependent or personal expense',
    question: 'Is this coaching fee for yourself or a dependent child? Please clarify for correct tax treatment.',
    priority: 'medium',
    category: 'unclear-expense',
    resolved: false,
  },
  {
    id: '3',
    itemDescription: 'Vehicle Purchase - ₹8,50,000',
    reason: 'Capital expense requires depreciation schedule instead of direct deduction',
    question: 'Confirm if vehicle is for business use. Need to calculate depreciation at 15% WDV rate.',
    priority: 'medium',
    category: 'verification-needed',
    resolved: false,
  },
  {
    id: '4',
    itemDescription: 'Purchases Missing Invoices - ₹12,000',
    reason: 'ITC claim may be reversed if GST invoices not provided',
    question: 'Please provide GST invoices for these purchases to claim Input Tax Credit.',
    priority: 'low',
    category: 'missing-doc',
    resolved: false,
  },
];

export const mockTaxCalculation: TaxCalculation = {
  grossIncome: 1575000,
  totalDeductions: 275000,
  taxableIncome: 1300000,
  taxOldRegime: 195000,
  taxNewRegime: 174000,
  recommendedRegime: 'new',
  savings: 21000,
};

export const mockAnalysisState: AnalysisState = {
  client: mockClient,
  documents: mockDocuments,
  income: mockIncome,
  expenses: mockExpenses,
  investments: mockInvestments,
  flags: mockFlags,
  taxCalculation: mockTaxCalculation,
  chatMessages: [],
};

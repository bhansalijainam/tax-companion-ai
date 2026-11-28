import type { DocKind } from '../domain/types.js';

/**
 * Synthetic client documents for the demo case. All names, PANs, account numbers
 * and amounts are fictional. They are deliberately messy in the ways real client
 * packs are: an ambiguous expense, a cash deposit, income in AIS with no certificate,
 * 80C over the cap, and rent above the landlord-PAN threshold.
 */
export interface SampleDocument {
  id: string;
  name: string;
  kind: DocKind;
  text: string;
}

export const SAMPLE_CLIENT = {
  name: 'Rahul Sharma',
  pan: 'AAAPZ9999Z',
  fy: '2024-25',
  ay: '2025-26',
  employer: 'Nimbus Analytics Pvt Ltd',
};

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'doc-form16',
    name: 'Form16_PartB_FY2024-25.pdf',
    kind: 'form16',
    text: `FORM NO. 16 — PART B (Annexure)
Details of Salary Paid and any other income and tax deducted
Name of Employer: Nimbus Analytics Pvt Ltd, Bengaluru     TAN: BLRN00000X
Name of Employee: Rahul Sharma     PAN of Employee: AAAPZ9999Z
Assessment Year: 2025-26     Period: 01-Apr-2024 to 31-Mar-2025
Regime opted by employee u/s 115BAC: No (Old regime)

1. Gross Salary
   (a) Salary as per provisions contained in section 17(1): Rs. 18,40,000
       of which Basic Salary: Rs. 8,40,000
       of which House Rent Allowance: Rs. 3,36,000
       of which Special Allowance: Rs. 6,64,000
   (b) Value of perquisites u/s 17(2): Rs. 0
   (d) Total: Rs. 18,40,000
2. Less: Allowances to the extent exempt u/s 10
   (e) House rent allowance u/s 10(13A): Rs. 2,76,000
4. Deductions under section 16
   (a) Standard deduction u/s 16(ia): Rs. 50,000
   (c) Tax on employment u/s 16(iii): Rs. 2,500
10. Deductions under Chapter VI-A
   (a) Deduction in respect of life insurance premia, contributions to provident fund etc. under section 80C
       Employee Provident Fund: Rs. 1,00,800
   (d) Section 80CCD(1B): Rs. 0
Rent declared by employee: Rs. 3,60,000 (Landlord PAN: not provided)
Total amount of tax deducted at source (TDS) u/s 192: Rs. 2,46,800
Verification: I, Priya Nair, Head - Payroll, certify that the information given above is true.`,
  },
  {
    id: 'doc-bank',
    name: 'HDFC_Savings_Statement_FY24-25.pdf',
    kind: 'bank-statement',
    text: `HDFC BANK — Statement of Account
Account Holder: RAHUL SHARMA   Account No: XXXXXXXX4821 (Savings)   Branch: Koramangala, Bengaluru
Period: 01/04/2024 to 31/03/2025

Date        Narration                                   Withdrawal     Deposit
05/04/2024  NEFT-ANAND KULKARNI-RENT APR                 30,000.00
07/04/2024  IMPS-SNEHA JOSHI-ANDHERI FLAT RENT APR                     28,000.00
30/06/2024  CREDIT INTEREST CAPITALISED                                 7,410.00
15/07/2024  BMC PROPERTY TAX - ANDHERI W FLAT 1203        14,000.00
14/08/2024  UPI-APEX COACHING CLASSES-FEE                45,000.00
30/09/2024  CREDIT INTEREST CAPITALISED                                 7,980.00
12/11/2024  CASH DEPOSIT - KORAMANGALA BRANCH                         2,50,000.00
31/12/2024  CREDIT INTEREST CAPITALISED                                 8,120.00
31/03/2025  CREDIT INTEREST CAPITALISED                                 8,130.00

Summary of recurring transactions (FY 2024-25):
  Rent paid to ANAND KULKARNI (12 months x 30,000): Total Rs. 3,60,000
  Rent received from SNEHA JOSHI - Andheri flat (12 months x 28,000): Total Rs. 3,36,000
  Total savings interest credited: Rs. 31,640
  Total cash deposits: Rs. 2,50,000`,
  },
  {
    id: 'doc-lic',
    name: 'LIC_Premium_Receipt_2024.pdf',
    kind: 'investment-proof',
    text: `LIFE INSURANCE CORPORATION OF INDIA
Premium Paid Certificate — For Income Tax Purposes
Policy No: 8812 4471 09   Plan: Jeevan Anand (915)   Life Assured: Rahul Sharma
Premium paid during 01-04-2024 to 31-03-2025: Rs. 50,000
Mode: Yearly. Sum assured: Rs. 10,00,000.
This premium is eligible for deduction under section 80C subject to applicable conditions.`,
  },
  {
    id: 'doc-ppf',
    name: 'PPF_Passbook_SBI.pdf',
    kind: 'investment-proof',
    text: `STATE BANK OF INDIA — Public Provident Fund Account
Account No: XXXXXX7730   Holder: Rahul Sharma
FY 2024-25 transactions
  18-Apr-2024  Deposit by transfer      25,000.00
  02-Jan-2025  Deposit by transfer      15,000.00
  31-Mar-2025  Interest @7.1%            9,862.00
Total deposits in FY 2024-25: Rs. 40,000 (interest exempt u/s 10(11))`,
  },
  {
    id: 'doc-health',
    name: 'Star_Health_Premium_Receipts.pdf',
    kind: 'insurance',
    text: `STAR HEALTH AND ALLIED INSURANCE CO. LTD — Premium Certificate u/s 80D
Policy 1: Family Health Optima — Insured: Rahul Sharma, Meera Sharma (spouse)
  Premium paid (incl. GST) for FY 2024-25: Rs. 28,500   Mode of payment: Net banking
Policy 2: Senior Citizens Red Carpet — Insured: Suresh Sharma (age 64), Kamala Sharma (age 61)
  Proposer: Rahul Sharma (son)
  Premium paid (incl. GST) for FY 2024-25: Rs. 32,000   Mode of payment: Credit card`,
  },
  {
    id: 'doc-homeloan',
    name: 'ICICI_HomeLoan_Interest_Certificate.pdf',
    kind: 'loan-certificate',
    text: `ICICI BANK — Provisional Interest Certificate (FY 2024-25)
Loan Account: LBMUM00009921   Borrower: Rahul Sharma
Property: Flat 1203, Lotus Heights, Andheri West, Mumbai (Status: Let out)
Principal repaid during the year: Rs. 1,20,000
Interest paid during the year: Rs. 2,10,000
Pre-EMI interest: Rs. 0`,
  },
  {
    id: 'doc-capgains',
    name: 'Zerodha_Tax_PnL_FY24-25.pdf',
    kind: 'capital-gains',
    text: `ZERODHA — Tax P&L Statement   Client: Rahul Sharma   FY 2024-25
Equity (listed, STT paid)
  Short Term Capital Gain (s.111A): Rs. 38,000
  Long Term Capital Gain (s.112A), before exemption: Rs. 1,95,000
  Intraday / speculative: Rs. 0
All realisations after 23-Jul-2024 unless stated. Grandfathering (31-Jan-2018 FMV) applied where relevant.`,
  },
  {
    id: 'doc-ais',
    name: 'AIS_FY2024-25.pdf',
    kind: 'ais',
    text: `ANNUAL INFORMATION STATEMENT (AIS) — PAN AAAPZ9999Z — FY 2024-25
Part B1: TDS/TCS information
  TDS - Salary (s.192) - Nimbus Analytics Pvt Ltd: 2,46,800
  TDS - Interest other than securities (s.194A) - State Bank of India: 5,230
  Total TDS reported: 2,52,030
Part B2: SFT information
  SFT-005 Interest income - Savings account - HDFC Bank: 31,640
  SFT-005 Interest income - Time deposit - State Bank of India: 52,300
  SFT-003 Cash deposits - HDFC Bank: 2,50,000
  SFT-018 Sale of listed equity shares - Zerodha Broking: reported`,
  },
];

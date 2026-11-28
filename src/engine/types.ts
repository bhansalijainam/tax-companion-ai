import type { Regime } from './rules.js';

/**
 * Normalised inputs for the tax engine. Every field is in rupees for the financial year.
 * The case file assembles this from reviewed facts; the engine never sees documents.
 */
export interface TaxInputs {
  salary: {
    gross: number; // gross salary incl. HRA, before any exemption
    basic: number; // basic + DA (for HRA exemption)
    hraReceived: number;
    rentPaid: number; // annual rent actually paid
    metro: boolean;
    professionalTax: number;
  };
  houseProperty: {
    letOutAnnualRent: number;
    letOutMunicipalTax: number;
    letOutLoanInterest: number;
    selfOccupiedLoanInterest: number;
  };
  otherSources: {
    savingsInterest: number;
    depositInterest: number;
    other: number;
  };
  capitalGains: {
    stcg111A: number;
    ltcg112A: number;
  };
  business: {
    netProfit: number;
  };
  deductions: {
    sec80C: number;
    sec80CCD1B: number;
    sec80D_self: number;
    sec80D_parents: number;
    parentsSenior: boolean;
    sec80E: number;
    sec80G: number; // qualifying amount after 50%/100% rules
  };
  taxesPaid: {
    tds: number;
    advanceTax: number;
  };
}

export interface TraceLine {
  /** Stable key, used by the UI and by the agent to cite lines */
  key: string;
  label: string;
  amount: number;
  /** Statutory reference, e.g. "s.16(ia)" */
  rule?: string;
  /** Human explanation of how this line was computed */
  note?: string;
  kind: 'income' | 'deduction' | 'subtotal' | 'tax' | 'credit' | 'total';
}

export interface TaxResult {
  regime: Regime;
  grossTotalIncome: number;
  totalDeductions: number;
  totalIncome: number; // after rounding u/s 288A
  normalIncome: number;
  taxOnNormalIncome: number;
  taxOnSpecialIncome: number;
  rebate87A: number;
  surcharge: number;
  cess: number;
  totalTax: number; // after rounding u/s 288B
  taxesPaid: number;
  netPayable: number; // negative = refund
  trace: TraceLine[];
  warnings: string[];
}

export interface RegimeComparison {
  old: TaxResult;
  new: TaxResult;
  recommended: Regime;
  savings: number;
}

export const emptyInputs = (): TaxInputs => ({
  salary: { gross: 0, basic: 0, hraReceived: 0, rentPaid: 0, metro: false, professionalTax: 0 }, // non-metro (40%) is the conservative default
  houseProperty: { letOutAnnualRent: 0, letOutMunicipalTax: 0, letOutLoanInterest: 0, selfOccupiedLoanInterest: 0 },
  otherSources: { savingsInterest: 0, depositInterest: 0, other: 0 },
  capitalGains: { stcg111A: 0, ltcg112A: 0 },
  business: { netProfit: 0 },
  deductions: { sec80C: 0, sec80CCD1B: 0, sec80D_self: 0, sec80D_parents: 0, parentsSenior: false, sec80E: 0, sec80G: 0 },
  taxesPaid: { tds: 0, advanceTax: 0 },
});

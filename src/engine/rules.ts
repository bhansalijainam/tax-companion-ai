/**
 * Indian income-tax rules for FY 2024-25 (AY 2025-26), individual resident below 60.
 *
 * Every number the product shows is derived from this file by deterministic code.
 * The LLM never does arithmetic: it extracts facts and explains results produced here.
 *
 * Source: Finance (No. 2) Act 2024 (Union Budget, 23 July 2024).
 */

export type Regime = 'old' | 'new';

export interface Slab {
  upTo: number; // inclusive upper bound of the slab; Infinity for the last slab
  rate: number;
}

export const FY = '2024-25';
export const AY = '2025-26';

export const SLABS: Record<Regime, Slab[]> = {
  // Section 115BAC (default regime), as amended by Finance (No. 2) Act 2024
  new: [
    { upTo: 300_000, rate: 0 },
    { upTo: 700_000, rate: 0.05 },
    { upTo: 1_000_000, rate: 0.1 },
    { upTo: 1_200_000, rate: 0.15 },
    { upTo: 1_500_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
  // Old regime, individual below 60
  old: [
    { upTo: 250_000, rate: 0 },
    { upTo: 500_000, rate: 0.05 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
};

/** Basic exemption limit: used for the shortfall adjustment against special-rate capital gains. */
export const BASIC_EXEMPTION: Record<Regime, number> = { new: 300_000, old: 250_000 };

/** Section 16(ia) */
export const STANDARD_DEDUCTION: Record<Regime, number> = { new: 75_000, old: 50_000 };

/** Section 16(iii): old regime only */
export const PROFESSIONAL_TAX_CAP = 2_500;

/** Section 87A rebate */
export const REBATE_87A: Record<Regime, { incomeLimit: number; maxRebate: number }> = {
  new: { incomeLimit: 700_000, maxRebate: 25_000 },
  old: { incomeLimit: 500_000, maxRebate: 12_500 },
};

/** Section 24(a): standard deduction on net annual value of house property */
export const HP_STANDARD_DEDUCTION_RATE = 0.3;
/** Section 24(b): interest cap on a self-occupied property (old regime only) */
export const HP_SELF_OCCUPIED_INTEREST_CAP = 200_000;
/** Section 71(3A): max house-property loss set off against other heads in a year (old regime) */
export const HP_LOSS_SETOFF_CAP = 200_000;

/** Chapter VI-A caps (old regime) */
export const DEDUCTION_CAPS = {
  sec80C: 150_000, // 80C + 80CCC + 80CCD(1) combined (80CCE)
  sec80CCD1B: 50_000,
  sec80D_self: 25_000, // self/family, below 60
  sec80D_parents: 25_000, // parents below 60
  sec80D_parentsSenior: 50_000, // parents 60+
  sec80TTA: 10_000, // savings-account interest
} as const;

/** Special rates on listed-equity capital gains (transfers on/after 23 July 2024) */
export const STCG_111A_RATE = 0.2;
export const LTCG_112A_RATE = 0.125;
export const LTCG_112A_EXEMPTION = 125_000;

/** Surcharge on income tax, by total income. Rates on 111A/112A gains are capped at 15%. */
export const SURCHARGE: Record<Regime, { above: number; rate: number }[]> = {
  old: [
    { above: 50_000_000, rate: 0.37 },
    { above: 20_000_000, rate: 0.25 },
    { above: 10_000_000, rate: 0.15 },
    { above: 5_000_000, rate: 0.1 },
  ],
  new: [
    { above: 20_000_000, rate: 0.25 }, // new regime caps surcharge at 25%
    { above: 10_000_000, rate: 0.15 },
    { above: 5_000_000, rate: 0.1 },
  ],
};
export const SURCHARGE_CAP_SPECIAL_RATE_GAINS = 0.15;

/** Health & education cess */
export const CESS_RATE = 0.04;

/** Section 10(13A) HRA exemption: share of basic salary allowed for metro / non-metro */
export const HRA_BASIC_SHARE = { metro: 0.5, nonMetro: 0.4 } as const;

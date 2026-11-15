import {
  BASIC_EXEMPTION,
  CESS_RATE,
  DEDUCTION_CAPS,
  HP_LOSS_SETOFF_CAP,
  HP_SELF_OCCUPIED_INTEREST_CAP,
  HP_STANDARD_DEDUCTION_RATE,
  HRA_BASIC_SHARE,
  LTCG_112A_EXEMPTION,
  LTCG_112A_RATE,
  PROFESSIONAL_TAX_CAP,
  REBATE_87A,
  Regime,
  SLABS,
  STANDARD_DEDUCTION,
  STCG_111A_RATE,
  SURCHARGE,
  SURCHARGE_CAP_SPECIAL_RATE_GAINS,
} from './rules';
import type { RegimeComparison, TaxInputs, TaxResult, TraceLine } from './types';

const r = (n: number) => Math.round(n);
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
/** s.288A / s.288B: round to the nearest multiple of ten */
export const round10 = (n: number) => Math.round(n / 10) * 10;
const pos = (n: number) => Math.max(0, n);

export function slabTax(income: number, regime: Regime): number {
  let tax = 0;
  let lower = 0;
  for (const slab of SLABS[regime]) {
    if (income <= lower) break;
    const taxable = Math.min(income, slab.upTo) - lower;
    tax += taxable * slab.rate;
    lower = slab.upTo;
  }
  return tax;
}

export function hraExemption(inputs: TaxInputs): number {
  const { hraReceived, rentPaid, basic, metro } = inputs.salary;
  if (hraReceived <= 0 || rentPaid <= 0) return 0;
  const share = metro ? HRA_BASIC_SHARE.metro : HRA_BASIC_SHARE.nonMetro;
  return pos(Math.min(hraReceived, rentPaid - 0.1 * basic, share * basic));
}

function surchargeRate(totalIncome: number, regime: Regime): { rate: number; threshold: number } {
  for (const band of SURCHARGE[regime]) {
    if (totalIncome > band.above) return { rate: band.rate, threshold: band.above };
  }
  return { rate: 0, threshold: 0 };
}

interface TaxCore {
  taxNormal: number;
  taxSpecial: number;
  rebate: number;
  marginalRelief87A: number;
  surcharge: number;
  surchargeRelief: number;
}

/** Income tax before cess on a given split of normal vs special-rate income. */
function taxCore(normalIncome: number, stcg: number, ltcg: number, regime: Regime, withSurcharge = true): TaxCore {
  const totalIncome = normalIncome + stcg + ltcg;

  // Unused basic exemption can absorb special-rate gains (proviso to s.111A / s.112A)
  let shortfall = pos(BASIC_EXEMPTION[regime] - normalIncome);
  const stcgTaxable = pos(stcg - shortfall);
  shortfall = pos(shortfall - stcg);
  const ltcgTaxable = pos(pos(ltcg - LTCG_112A_EXEMPTION) - shortfall);

  const taxNormal = slabTax(normalIncome, regime);
  const taxSpecial = stcgTaxable * STCG_111A_RATE + ltcgTaxable * LTCG_112A_RATE;

  // s.87A rebate — applied against slab-rate tax only (conservative reading for special-rate gains)
  const { incomeLimit, maxRebate } = REBATE_87A[regime];
  let rebate = 0;
  let marginalRelief87A = 0;
  if (totalIncome <= incomeLimit) {
    rebate = Math.min(taxNormal, maxRebate);
  } else if (regime === 'new' && stcg + ltcg === 0) {
    // New-regime marginal relief: tax may not exceed the income above the rebate limit
    const excess = totalIncome - incomeLimit;
    if (taxNormal > excess) marginalRelief87A = taxNormal - excess;
  }

  const normalAfterRebate = pos(taxNormal - rebate - marginalRelief87A);

  let surcharge = 0;
  let surchargeRelief = 0;
  if (withSurcharge) {
    const { rate, threshold } = surchargeRate(totalIncome, regime);
    if (rate > 0) {
      surcharge =
        normalAfterRebate * rate + taxSpecial * Math.min(rate, SURCHARGE_CAP_SPECIAL_RATE_GAINS);
      // Marginal relief: tax + surcharge may not exceed tax at the threshold + income above it
      const scale = threshold / totalIncome;
      const atThreshold = taxCore(normalIncome * scale, stcg * scale, ltcg * scale, regime, true);
      const capAtThreshold =
        atThreshold.taxNormal - atThreshold.rebate - atThreshold.marginalRelief87A +
        atThreshold.taxSpecial + atThreshold.surcharge - atThreshold.surchargeRelief;
      const cap = capAtThreshold + (totalIncome - threshold);
      const withS = normalAfterRebate + taxSpecial + surcharge;
      if (withS > cap) surchargeRelief = Math.min(surcharge, withS - cap);
    }
  }

  return { taxNormal, taxSpecial, rebate, marginalRelief87A, surcharge, surchargeRelief };
}

export function computeTax(inputs: TaxInputs, regime: Regime): TaxResult {
  const trace: TraceLine[] = [];
  const warnings: string[] = [];
  const add = (line: TraceLine) => trace.push({ ...line, amount: r(line.amount) });
  const isOld = regime === 'old';

  // ── Salary ────────────────────────────────────────────────────────────────
  const s = inputs.salary;
  add({ key: 'salary.gross', label: 'Gross salary', amount: s.gross, rule: 's.17', kind: 'income' });

  const hra = isOld ? hraExemption(inputs) : 0;
  if (isOld && s.hraReceived > 0) {
    add({
      key: 'salary.hra', label: 'HRA exemption', amount: -hra, rule: 's.10(13A)', kind: 'deduction',
      note: s.rentPaid > 0
        ? `Least of HRA received ${fmt(s.hraReceived)}, rent − 10% of basic ${fmt(pos(s.rentPaid - 0.1 * s.basic))}, ${s.metro ? '50' : '40'}% of basic ${fmt((s.metro ? 0.5 : 0.4) * s.basic)}`
        : 'No rent paid — HRA fully taxable',
    });
  }

  const salaryAfterHra = pos(s.gross - hra);
  const stdDed = Math.min(STANDARD_DEDUCTION[regime], salaryAfterHra);
  if (s.gross > 0) {
    add({ key: 'salary.std', label: 'Standard deduction', amount: -stdDed, rule: 's.16(ia)', kind: 'deduction' });
  }
  const profTax = isOld ? Math.min(s.professionalTax, PROFESSIONAL_TAX_CAP) : 0;
  if (isOld && profTax > 0) {
    add({ key: 'salary.pt', label: 'Professional tax', amount: -profTax, rule: 's.16(iii)', kind: 'deduction' });
  }
  const salaryIncome = pos(salaryAfterHra - stdDed - profTax);
  add({ key: 'salary.net', label: 'Income from salary', amount: salaryIncome, kind: 'subtotal' });

  // ── House property ────────────────────────────────────────────────────────
  const hp = inputs.houseProperty;
  const nav = pos(hp.letOutAnnualRent - hp.letOutMunicipalTax);
  const letOutIncome = nav - nav * HP_STANDARD_DEDUCTION_RATE - hp.letOutLoanInterest;
  const selfOccInterest = isOld ? Math.min(hp.selfOccupiedLoanInterest, HP_SELF_OCCUPIED_INTEREST_CAP) : 0;
  const hpRaw = letOutIncome - selfOccInterest;
  let hpIncome = hpRaw;
  if (hpRaw < 0) {
    hpIncome = isOld ? Math.max(hpRaw, -HP_LOSS_SETOFF_CAP) : 0;
    const carried = r(hpIncome - hpRaw);
    if (carried > 0) {
      warnings.push(
        isOld
          ? `House-property loss of ₹${fmt(carried)} exceeds the ₹2,00,000 set-off cap and is carried forward (s.71B).`
          : `House-property loss of ₹${fmt(carried)} cannot be set off against other heads in the new regime (s.115BAC(2)).`,
      );
    }
  }
  if (hp.letOutAnnualRent > 0 || hp.selfOccupiedLoanInterest > 0) {
    add({
      key: 'hp.net', label: 'Income from house property', amount: hpIncome, rule: 's.22–24', kind: 'subtotal',
      note: `NAV ${fmt(nav)} − 30% standard deduction ${fmt(nav * HP_STANDARD_DEDUCTION_RATE)} − interest ${fmt(hp.letOutLoanInterest + selfOccInterest)}`,
    });
  }

  // ── Other sources & business ──────────────────────────────────────────────
  const os = inputs.otherSources;
  const otherSources = os.savingsInterest + os.depositInterest + os.other;
  if (otherSources > 0) {
    add({ key: 'os.net', label: 'Income from other sources', amount: otherSources, rule: 's.56', kind: 'subtotal',
      note: `Savings interest ${fmt(os.savingsInterest)} + deposit interest ${fmt(os.depositInterest)} + other ${fmt(os.other)}` });
  }
  const business = inputs.business.netProfit;
  if (business !== 0) {
    add({ key: 'pgbp.net', label: 'Profits of business / profession', amount: business, rule: 's.28', kind: 'subtotal' });
  }

  const normalGross = pos(salaryIncome + hpIncome + otherSources + business);
  const { stcg111A: stcg, ltcg112A: ltcg } = inputs.capitalGains;
  if (stcg > 0) add({ key: 'cg.stcg', label: 'Short-term capital gains (s.111A)', amount: stcg, rule: 's.111A', kind: 'income' });
  if (ltcg > 0) add({ key: 'cg.ltcg', label: 'Long-term capital gains (s.112A)', amount: ltcg, rule: 's.112A', kind: 'income' });

  const grossTotalIncome = normalGross + stcg + ltcg;
  add({ key: 'gti', label: 'Gross total income', amount: grossTotalIncome, kind: 'subtotal' });

  // ── Chapter VI-A (old regime only; not available against s.111A/112A gains) ──
  let totalDeductions = 0;
  if (isOld) {
    const d = inputs.deductions;
    const items: [string, string, number, string, number?][] = [
      ['ded.80c', 'Section 80C', d.sec80C, 's.80C/80CCE', DEDUCTION_CAPS.sec80C],
      ['ded.80ccd1b', 'NPS (additional)', d.sec80CCD1B, 's.80CCD(1B)', DEDUCTION_CAPS.sec80CCD1B],
      ['ded.80d_self', 'Health insurance — self/family', d.sec80D_self, 's.80D', DEDUCTION_CAPS.sec80D_self],
      ['ded.80d_parents', 'Health insurance — parents', d.sec80D_parents, 's.80D',
        d.parentsSenior ? DEDUCTION_CAPS.sec80D_parentsSenior : DEDUCTION_CAPS.sec80D_parents],
      ['ded.80tta', 'Savings interest', os.savingsInterest, 's.80TTA', DEDUCTION_CAPS.sec80TTA],
      ['ded.80e', 'Education loan interest', d.sec80E, 's.80E'],
      ['ded.80g', 'Donations', d.sec80G, 's.80G'],
    ];
    for (const [key, label, claimed, rule, cap] of items) {
      if (claimed <= 0) continue;
      const allowed = cap === undefined ? claimed : Math.min(claimed, cap);
      totalDeductions += allowed;
      add({
        key, label, amount: -allowed, rule, kind: 'deduction',
        note: cap !== undefined && claimed > cap ? `Claimed ${fmt(claimed)}, capped at ${fmt(cap)}` : undefined,
      });
    }
    if (totalDeductions > normalGross) {
      warnings.push('Chapter VI-A deductions exceed normal-rate income; excess is lost (cannot reduce capital-gains tax).');
      totalDeductions = normalGross;
    }
  } else {
    add({ key: 'ded.none', label: 'Chapter VI-A deductions', amount: 0, rule: 's.115BAC(2)', kind: 'deduction',
      note: 'Not available in the new regime' });
  }

  const normalIncome = pos(normalGross - totalDeductions);
  const totalIncome = round10(normalIncome + stcg + ltcg);
  add({ key: 'ti', label: 'Total taxable income', amount: totalIncome, rule: 's.288A', kind: 'subtotal' });

  // ── Tax ───────────────────────────────────────────────────────────────────
  const core = taxCore(normalIncome, stcg, ltcg, regime);
  add({ key: 'tax.slab', label: `Tax at ${regime} regime slab rates`, amount: core.taxNormal, kind: 'tax' });
  if (core.taxSpecial > 0) {
    add({ key: 'tax.special', label: 'Tax on capital gains at special rates', amount: core.taxSpecial, rule: 's.111A/112A', kind: 'tax',
      note: `STCG @20%, LTCG @12.5% above ₹1,25,000` });
  }
  if (core.rebate > 0) add({ key: 'tax.87a', label: 'Rebate', amount: -core.rebate, rule: 's.87A', kind: 'credit' });
  if (core.marginalRelief87A > 0) {
    add({ key: 'tax.87a_mr', label: 'Marginal relief on rebate', amount: -core.marginalRelief87A, rule: 's.87A proviso', kind: 'credit' });
  }
  const surcharge = core.surcharge - core.surchargeRelief;
  if (surcharge > 0) add({ key: 'tax.surcharge', label: 'Surcharge (after marginal relief)', amount: surcharge, kind: 'tax' });

  const taxBeforeCess = pos(core.taxNormal - core.rebate - core.marginalRelief87A) + core.taxSpecial + surcharge;
  const cess = taxBeforeCess * CESS_RATE;
  add({ key: 'tax.cess', label: 'Health & education cess @4%', amount: cess, kind: 'tax' });

  const totalTax = round10(taxBeforeCess + cess);
  add({ key: 'tax.total', label: 'Total tax liability', amount: totalTax, rule: 's.288B', kind: 'total' });

  const taxesPaid = inputs.taxesPaid.tds + inputs.taxesPaid.advanceTax;
  if (taxesPaid > 0) add({ key: 'tax.paid', label: 'TDS & advance tax paid', amount: -taxesPaid, kind: 'credit' });
  const netPayable = totalTax - taxesPaid;
  add({ key: 'tax.net', label: netPayable >= 0 ? 'Net tax payable' : 'Refund due', amount: netPayable, kind: 'total' });

  return {
    regime,
    grossTotalIncome: r(grossTotalIncome),
    totalDeductions: r(totalDeductions),
    totalIncome,
    normalIncome: r(normalIncome),
    taxOnNormalIncome: r(core.taxNormal),
    taxOnSpecialIncome: r(core.taxSpecial),
    rebate87A: r(core.rebate + core.marginalRelief87A),
    surcharge: r(surcharge),
    cess: r(cess),
    totalTax,
    taxesPaid: r(taxesPaid),
    netPayable: r(netPayable),
    trace,
    warnings,
  };
}

export function compareRegimes(inputs: TaxInputs): RegimeComparison {
  const oldR = computeTax(inputs, 'old');
  const newR = computeTax(inputs, 'new');
  // Ties go to the new regime: it is the default and needs no Form 10-IEA
  const recommended = oldR.totalTax < newR.totalTax ? 'old' : 'new';
  return { old: oldR, new: newR, recommended, savings: Math.abs(oldR.totalTax - newR.totalTax) };
}

/** Remaining capacity under each capped old-regime deduction. */
export function deductionHeadroom(inputs: TaxInputs) {
  const d = inputs.deductions;
  return [
    { section: '80C', claimed: d.sec80C, cap: DEDUCTION_CAPS.sec80C },
    { section: '80CCD(1B)', claimed: d.sec80CCD1B, cap: DEDUCTION_CAPS.sec80CCD1B },
    { section: '80D (self)', claimed: d.sec80D_self, cap: DEDUCTION_CAPS.sec80D_self },
    {
      section: '80D (parents)', claimed: d.sec80D_parents,
      cap: d.parentsSenior ? DEDUCTION_CAPS.sec80D_parentsSenior : DEDUCTION_CAPS.sec80D_parents,
    },
  ].map((h) => ({ ...h, remaining: pos(h.cap - h.claimed) }));
}

/**
 * Extra old-regime deductions (beyond current claims) at which the old regime
 * becomes cheaper than the new one. Returns 0 if old is already cheaper, null if
 * no amount up to ₹10L would do it.
 */
export function oldRegimeBreakEven(inputs: TaxInputs): number | null {
  const newTax = computeTax(inputs, 'new').totalTax;
  const oldTaxWith = (extra: number) =>
    computeTax({ ...inputs, deductions: { ...inputs.deductions, sec80G: inputs.deductions.sec80G + extra } }, 'old').totalTax;
  if (oldTaxWith(0) < newTax) return 0;
  let lo = 0;
  let hi = 1_000_000;
  if (oldTaxWith(hi) >= newTax) return null;
  while (hi - lo > 100) {
    const mid = (lo + hi) / 2;
    if (oldTaxWith(mid) < newTax) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 100) * 100;
}

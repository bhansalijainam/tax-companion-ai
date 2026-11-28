import { describe, expect, it } from 'vitest';
import { compareRegimes, computeTax, hraExemption, oldRegimeBreakEven, slabTax } from './compute.js';
import { emptyInputs, TaxInputs } from './types.js';

/** Build inputs from a partial patch (one level deep per head). */
function inputs(patch: { [K in keyof TaxInputs]?: Partial<TaxInputs[K]> }): TaxInputs {
  const base = emptyInputs();
  for (const k of Object.keys(patch) as (keyof TaxInputs)[]) {
    Object.assign(base[k], patch[k]);
  }
  return base;
}

// All expected values below were computed by hand from the FY 2024-25 slabs.
describe('slabTax', () => {
  it('new regime at ₹15L', () => expect(slabTax(1_500_000, 'new')).toBe(140_000));
  it('old regime at ₹10.5L', () => expect(slabTax(1_050_000, 'old')).toBe(127_500));
  it('zero below exemption', () => {
    expect(slabTax(300_000, 'new')).toBe(0);
    expect(slabTax(250_000, 'old')).toBe(0);
  });
});

describe('new regime', () => {
  it('full s.87A rebate at exactly ₹7L taxable', () => {
    const r = computeTax(inputs({ salary: { gross: 775_000 } }), 'new');
    expect(r.totalIncome).toBe(700_000);
    expect(r.rebate87A).toBe(20_000);
    expect(r.totalTax).toBe(0);
  });

  it('applies 87A marginal relief just above ₹7L', () => {
    // taxable 7,10,000 → slab tax 21,000, capped at income above 7L = 10,000; + 4% cess
    const r = computeTax(inputs({ salary: { gross: 785_000 } }), 'new');
    expect(r.totalTax).toBe(10_400);
  });

  it('no marginal relief once slab tax is below the excess', () => {
    const r = computeTax(inputs({ salary: { gross: 800_000 } }), 'new');
    expect(r.totalTax).toBe(23_400); // 22,500 + 900 cess
  });

  it('salary of ₹15.75L → ₹1,45,600', () => {
    const r = computeTax(inputs({ salary: { gross: 1_575_000 } }), 'new');
    expect(r.totalIncome).toBe(1_500_000);
    expect(r.totalTax).toBe(145_600);
  });

  it('ignores Chapter VI-A deductions and HRA', () => {
    const r = computeTax(
      inputs({
        salary: { gross: 1_575_000, basic: 600_000, hraReceived: 240_000, rentPaid: 300_000 },
        deductions: { sec80C: 150_000, sec80D_self: 25_000 },
      }),
      'new',
    );
    expect(r.totalDeductions).toBe(0);
    expect(r.totalTax).toBe(145_600);
  });

  it('taxes LTCG at 12.5% above ₹1.25L', () => {
    const r = computeTax(inputs({ salary: { gross: 1_075_000 }, capitalGains: { ltcg112A: 225_000 } }), 'new');
    // slab tax on 10L = 50,000; LTCG (2.25L − 1.25L) × 12.5% = 12,500; cess 2,500
    expect(r.totalTax).toBe(65_000);
  });

  it('lets unused basic exemption absorb STCG', () => {
    const r = computeTax(inputs({ capitalGains: { stcg111A: 400_000 } }), 'new');
    // shortfall 3L → 1L taxable @20% = 20,000 + 800 cess (rebate not applied to special-rate tax)
    expect(r.totalTax).toBe(20_800);
  });

  it('does not set off house-property loss against salary', () => {
    const r = computeTax(inputs({ salary: { gross: 1_250_000 }, houseProperty: { selfOccupiedLoanInterest: 250_000 } }), 'new');
    expect(r.totalIncome).toBe(1_175_000);
    expect(r.totalTax).toBe(79_300);
  });

  it('applies 10% surcharge above ₹50L', () => {
    const r = computeTax(inputs({ salary: { gross: 6_075_000 } }), 'new');
    expect(r.surcharge).toBe(149_000);
    expect(r.totalTax).toBe(1_704_560);
  });

  it('applies surcharge marginal relief just above ₹50L', () => {
    const r = computeTax(inputs({ salary: { gross: 5_085_000 } }), 'new');
    // tax+surcharge capped at tax on 50L (11,90,000) + 10,000 = 12,00,000; + 4% cess
    expect(r.totalTax).toBe(1_248_000);
  });
});

describe('old regime', () => {
  it('₹12.5L salary with full 80C → ₹1,32,600', () => {
    const r = computeTax(inputs({ salary: { gross: 1_250_000 }, deductions: { sec80C: 150_000 } }), 'old');
    expect(r.totalIncome).toBe(1_050_000);
    expect(r.totalTax).toBe(132_600);
  });

  it('caps 80C at ₹1.5L', () => {
    const r = computeTax(inputs({ salary: { gross: 1_250_000 }, deductions: { sec80C: 400_000 } }), 'old');
    expect(r.totalDeductions).toBe(150_000);
  });

  it('full rebate at ₹5L taxable', () => {
    const r = computeTax(inputs({ salary: { gross: 550_000 } }), 'old');
    expect(r.totalTax).toBe(0);
  });

  it('caps self-occupied interest and loss set-off at ₹2L', () => {
    const r = computeTax(inputs({ salary: { gross: 1_250_000 }, houseProperty: { selfOccupiedLoanInterest: 250_000 } }), 'old');
    expect(r.totalIncome).toBe(1_000_000);
    expect(r.totalTax).toBe(117_000);
  });

  it('computes HRA exemption as the least of three limbs', () => {
    const i = inputs({ salary: { gross: 1_200_000, basic: 600_000, hraReceived: 240_000, rentPaid: 240_000, metro: true } });
    expect(hraExemption(i)).toBe(180_000); // rent − 10% basic
    expect(hraExemption({ ...i, salary: { ...i.salary, rentPaid: 0 } })).toBe(0);
    // Non-metro (e.g. Bengaluru): 40% of basic becomes the binding limb
    expect(hraExemption({ ...i, salary: { ...i.salary, rentPaid: 400_000, metro: false } })).toBe(240_000);
  });

  it('allows 80TTA up to ₹10k on savings interest only', () => {
    const r = computeTax(inputs({ salary: { gross: 1_000_000 }, otherSources: { savingsInterest: 32_000, depositInterest: 45_000 } }), 'old');
    expect(r.trace.find((l) => l.key === 'ded.80tta')?.amount).toBe(-10_000);
  });
});

describe('regime comparison', () => {
  it('recommends the cheaper regime and reports savings', () => {
    const c = compareRegimes(inputs({ salary: { gross: 1_575_000 } }));
    expect(c.recommended).toBe('new');
    expect(c.savings).toBe(c.old.totalTax - c.new.totalTax);
  });

  it('prefers old when deductions are large', () => {
    const c = compareRegimes(
      inputs({
        salary: { gross: 1_500_000, basic: 750_000, hraReceived: 300_000, rentPaid: 420_000 },
        houseProperty: { selfOccupiedLoanInterest: 200_000 },
        deductions: { sec80C: 150_000, sec80CCD1B: 50_000, sec80D_self: 25_000, sec80D_parents: 50_000, parentsSenior: true },
      }),
    );
    expect(c.recommended).toBe('old');
  });

  it('finds the break-even deduction for the old regime', () => {
    const i = inputs({ salary: { gross: 1_575_000 } });
    const extra = oldRegimeBreakEven(i)!;
    expect(extra).toBeGreaterThan(0);
    const withExtra = { ...i, deductions: { ...i.deductions, sec80G: extra } };
    expect(computeTax(withExtra, 'old').totalTax).toBeLessThan(computeTax(i, 'new').totalTax);
  });

  it('net payable subtracts TDS', () => {
    const r = computeTax(inputs({ salary: { gross: 1_575_000 }, taxesPaid: { tds: 150_000 } }), 'new');
    expect(r.netPayable).toBe(145_600 - 150_000);
  });
});

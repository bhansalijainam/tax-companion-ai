import * as R from '../../engine/rules';
import { numbersIn } from '../extraction/grounding';

/** Statutory constants the assistant may quote without a tool call. */
const STATUTORY = new Set<number>([
  ...Object.values(R.DEDUCTION_CAPS),
  ...Object.values(R.STANDARD_DEDUCTION),
  ...Object.values(R.BASIC_EXEMPTION),
  ...Object.values(R.REBATE_87A).flatMap((v) => [v.incomeLimit, v.maxRebate]),
  ...Object.values(R.SLABS).flatMap((s) => s.map((x) => x.upTo)).filter(Number.isFinite),
  R.LTCG_112A_EXEMPTION, R.HP_LOSS_SETOFF_CAP, R.HP_SELF_OCCUPIED_INTEREST_CAP, R.PROFESSIONAL_TAX_CAP,
]);

export interface GroundingReport {
  amounts: { text: string; value: number; grounded: boolean }[];
  ok: boolean;
}

/** Rupee amounts written in an answer: ₹1,23,456 / Rs. 50,000 / 1,23,456 */
const AMOUNT_RE = /(?:₹|rs\.?\s?|inr\s?)\s?\d[\d,]*(?:\.\d+)?|\b\d{1,3}(?:,\d{2})*,\d{3}\b/gi;

/**
 * Every rupee amount in the assistant's answer must appear in a tool result, in the
 * user's own message, or be a statutory constant. Anything else is a number the model
 * produced itself — exactly what this product must never show unflagged.
 */
export function checkAnswerGrounding(answer: string, evidence: string[]): GroundingReport {
  const known = new Set<number>();
  for (const e of evidence) for (const n of numbersIn(e)) known.add(Math.round(Math.abs(n)));
  const amounts = [...answer.matchAll(AMOUNT_RE)]
    .map((m) => ({ text: m[0].trim(), value: Math.round(numbersIn(m[0])[0] ?? NaN) }))
    .filter((a) => Number.isFinite(a.value) && a.value >= 100)
    .map((a) => ({ ...a, grounded: known.has(a.value) || STATUTORY.has(a.value) || known.has(a.value + 1) || known.has(a.value - 1) }));
  return { amounts, ok: amounts.every((a) => a.grounded) };
}

import type { Fact } from '../src/domain/types';
import type { ExtractionCase, GoldFact } from './datasets/extraction';

const sameValue = (a: number | boolean | string, b: number | string) => {
  if (typeof b === 'string') return String(a).toUpperCase() === b.toUpperCase();
  const av = typeof a === 'boolean' ? (a ? 1 : 0) : Number(a);
  return Math.abs(av - b) <= 1;
};

export interface CaseScore {
  id: string;
  split: ExtractionCase['split'];
  tp: number;
  fp: number;
  fn: number;
  kindCorrect: boolean;
  groundedRate: number | null;
  ambiguityHit: boolean | null;
  forbiddenHits: number;
  missed: GoldFact[];
  extra: { field: string; value: number | boolean | string }[];
  latencyMs: number;
  error?: string;
}

/** Field-level multiset matching: each gold fact can be matched by at most one prediction. */
export function scoreCase(
  c: ExtractionCase,
  pred: { kind: string; facts: Fact[]; ambiguities: string[]; latencyMs: number },
): CaseScore {
  const remaining = [...pred.facts];
  const missed: GoldFact[] = [];
  let tp = 0;
  for (const g of c.gold) {
    const i = remaining.findIndex((f) => f.field === g.field && sameValue(f.value, g.value));
    if (i >= 0) {
      tp++;
      remaining.splice(i, 1);
    } else missed.push(g);
  }
  const forbiddenHits = (c.forbidden ?? []).filter((g) => pred.facts.some((f) => f.field === g.field && sameValue(f.value, g.value))).length;
  const verifiable = pred.facts.filter((f) => f.grounded !== null);
  return {
    id: c.id,
    split: c.split,
    tp,
    fp: remaining.length,
    fn: missed.length,
    kindCorrect: pred.kind === c.kind || (c.acceptKinds ?? []).includes(pred.kind as never),
    groundedRate: verifiable.length ? verifiable.filter((f) => f.grounded).length / verifiable.length : null,
    ambiguityHit: c.expectAmbiguity
      ? c.expectAmbiguity.every((k) => pred.ambiguities.some((a) => a.toLowerCase().includes(k.toLowerCase())))
      : null,
    forbiddenHits,
    missed,
    extra: remaining.map((f) => ({ field: f.field, value: f.value })),
    latencyMs: pred.latencyMs,
  };
}

export function aggregate(scores: CaseScore[]) {
  const sum = (k: 'tp' | 'fp' | 'fn') => scores.reduce((s, x) => s + x[k], 0);
  const tp = sum('tp');
  const fp = sum('fp');
  const fn = sum('fn');
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const grounded = scores.map((s) => s.groundedRate).filter((x): x is number => x !== null);
  const amb = scores.map((s) => s.ambiguityHit).filter((x): x is boolean => x !== null);
  return {
    cases: scores.length,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    docTypeAccuracy: scores.filter((s) => s.kindCorrect).length / (scores.length || 1),
    groundedRate: grounded.length ? grounded.reduce((a, b) => a + b, 0) / grounded.length : null,
    ambiguityRecall: amb.length ? amb.filter(Boolean).length / amb.length : null,
    forbiddenHits: scores.reduce((s, x) => s + x.forbiddenHits, 0),
    errors: scores.filter((s) => s.error).length,
    meanLatencyMs: Math.round(scores.reduce((s, x) => s + x.latencyMs, 0) / (scores.length || 1)),
  };
}

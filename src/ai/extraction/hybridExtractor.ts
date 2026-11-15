/**
 * Regex-first, LLM-on-demand extraction.
 *
 * The eval shows the rules baseline is exact on layouts it knows (100% template recall)
 * and blind on everything else (14% variant recall). So: run the free deterministic
 * path first, check whether it covered the fields every document of that type must
 * contain, and pay for an LLM call only when it did not.
 *
 * The coverage check is deliberately strict. A partial rules extraction that silently
 * misses a field is worse than an LLM call, so any missing anchor routes to the LLM.
 */
import type { FactField } from '../../domain/fields';
import type { CaseDocument, DocKind } from '../../domain/types';
import type { Extractor, ExtractorRun } from './llmExtractor';
import { rulesExtract } from './rulesExtractor';
import type { ExtractionOutput } from './schema';

/**
 * Fields a complete extraction of each document type must include (any one of a group).
 * 'other' has no anchors: unknown documents always go to the LLM.
 */
export const COVERAGE_ANCHORS: Partial<Record<DocKind, FactField[][]>> = {
  form16: [['salary.gross'], ['taxesPaid.tds']],
  'bank-statement': [['otherSources.savingsInterest']],
  ais: [['recon.aisTds']],
  'capital-gains': [['capitalGains.stcg111A', 'capitalGains.ltcg112A']],
  insurance: [['deductions.sec80D_self', 'deductions.sec80D_parents']],
  'loan-certificate': [['houseProperty.letOutLoanInterest', 'houseProperty.selfOccupiedLoanInterest']],
  'investment-proof': [['deductions.sec80C', 'deductions.sec80CCD1B', 'otherSources.depositInterest']],
  'rent-receipt': [['salary.rentPaid']],
};

export interface RouteDecision {
  path: 'rules' | 'llm';
  reason: string;
  rulesOutput?: ExtractionOutput;
}

/** Pure routing decision — no I/O, so it can be evaluated without an API key. */
export function decideRoute(doc: Pick<CaseDocument, 'name' | 'text'>): RouteDecision {
  if (!doc.text) return { path: 'llm', reason: 'no text layer (PDF/image)' };
  const out = rulesExtract(doc);
  const anchors = COVERAGE_ANCHORS[out.documentType];
  if (!anchors) return { path: 'llm', reason: `unrecognised document type (${out.documentType})` };
  const present = new Set(out.facts.map((f) => f.field));
  const missing = anchors.filter((group) => !group.some((f) => present.has(f)));
  if (missing.length) {
    return { path: 'llm', reason: `rules missed required field(s): ${missing.map((g) => g.join(' | ')).join(', ')}` };
  }
  return { path: 'rules', reason: `rules covered all ${anchors.length} required field group(s) for ${out.documentType}`, rulesOutput: out };
}

export class HybridExtractor implements Extractor {
  readonly id: string;
  constructor(private llm: Extractor) {
    this.id = `hybrid(rules:v1→${llm.id})`;
  }

  async extract(doc: Pick<CaseDocument, 'name' | 'text' | 'base64' | 'mimeType'>): Promise<ExtractorRun> {
    const started = performance.now();
    const decision = decideRoute(doc);
    if (decision.path === 'rules' && decision.rulesOutput) {
      return {
        output: decision.rulesOutput,
        extractor: 'rules:v1',
        latencyMs: Math.round(performance.now() - started),
        route: { path: 'rules', reason: decision.reason },
      };
    }
    const run = await this.llm.extract(doc);
    return { ...run, route: { path: 'llm', reason: decision.reason } };
  }
}

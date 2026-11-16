import { describe, expect, it } from 'vitest';
import { EXTRACTION_CASES } from '../../../evals/datasets/extraction';
import { SAMPLE_DOCUMENTS } from '../../fixtures/sampleDocuments';
import { applyExtraction } from '../pipeline';
import { decideRoute, HybridExtractor } from './hybridExtractor';
import type { Extractor, ExtractorRun } from './llmExtractor';
import { RulesExtractor } from './rulesExtractor';

const fakeLlm = (): Extractor & { calls: number } => {
  const e = {
    id: 'fake:llm',
    calls: 0,
    async extract(): Promise<ExtractorRun> {
      e.calls++;
      return { output: { documentType: 'other', summary: '', facts: [], ambiguities: [] }, extractor: 'fake:llm', latencyMs: 1 };
    },
  };
  return e;
};

describe('hybrid routing (regex first, LLM on demand)', () => {
  it('keeps every template document on the free rules path', () => {
    for (const d of SAMPLE_DOCUMENTS) expect(decideRoute(d).path, d.name).toBe('rules');
  });

  it('sends every variant layout to the LLM, because rules miss required fields there', () => {
    for (const c of EXTRACTION_CASES.filter((x) => x.split === 'variant')) {
      expect(decideRoute(c).path, c.id).toBe('llm');
    }
  });

  it('routes binary documents to the LLM', () => {
    expect(decideRoute({ name: 'scan.pdf', text: undefined }).path).toBe('llm');
  });

  it('only calls the LLM when needed and records why', async () => {
    const llm = fakeLlm();
    const hybrid = new HybridExtractor(llm);
    const t = await hybrid.extract({ ...SAMPLE_DOCUMENTS[0], mimeType: 'text/plain' });
    expect(t.route?.path).toBe('rules');
    expect(llm.calls).toBe(0);
    const v = EXTRACTION_CASES.find((c) => c.id === 'var-form16-tabular')!;
    const r = await hybrid.extract({ name: v.name, text: v.text, mimeType: 'text/plain' });
    expect(r.route).toMatchObject({ path: 'llm' });
    expect(r.route?.reason).toMatch(/salary\.gross/);
    expect(llm.calls).toBe(1);
  });
});

// ECC ai-regression-testing, pattern 1: demo and live paths must not drift apart.
describe('demo/live path parity', () => {
  it('rules and LLM runs flow through the same finalisation into the same fact shape', async () => {
    const doc = { id: 'd', name: 'k.txt', text: 'Total savings interest credited: Rs. 9,870', mimeType: 'text/plain' };
    const rulesRun = await new RulesExtractor().extract({ ...doc, text: 'Statement of account\n' + doc.text });
    const llmRun: ExtractorRun = {
      extractor: 'anthropic:test', latencyMs: 1,
      output: { documentType: 'bank-statement', summary: '', ambiguities: [], facts: [
        { field: 'otherSources.savingsInterest', amount: 9870, text: null, label: 'x', quote: 'Total savings interest credited: Rs. 9,870', page: 1, confidence: 0.95 },
      ] },
    };
    const a = applyExtraction({ ...doc, text: 'Statement of account\n' + doc.text }, rulesRun).facts[0];
    const b = applyExtraction(doc, llmRun).facts[0];
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect([a.field, a.value, a.grounded, a.origin]).toEqual(['otherSources.savingsInterest', 9870, true, 'rules']);
    expect([b.field, b.value, b.grounded, b.origin]).toEqual(['otherSources.savingsInterest', 9870, true, 'llm']);
  });
});

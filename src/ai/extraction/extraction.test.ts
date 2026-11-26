import { describe, expect, it } from 'vitest';
import { SAMPLE_DOCUMENTS } from '../../fixtures/sampleDocuments.js';
import { amountOnLine, detectKind, rulesExtract } from './rulesExtractor.js';
import { checkGrounding, finalizeExtraction } from './grounding.js';
import { ExtractionOutput, extractionJsonSchema } from './schema.js';

const doc = (id: string) => SAMPLE_DOCUMENTS.find((d) => d.id === id)!;

describe('amountOnLine', () => {
  it('prefers Rs.-prefixed amounts', () => expect(amountOnLine('Premium paid for FY 2024-25: Rs. 28,500')).toBe(28_500));
  it('reads statement columns', () => expect(amountOnLine('15/07/2024  BMC PROPERTY TAX  14,000.00')).toBe(14_000));
  it('returns null without an amount', () => expect(amountOnLine('Policy No: 8812 4471 09')).toBeNull());
});

describe('rules baseline on the sample pack', () => {
  it('classifies every sample document correctly', () => {
    for (const d of SAMPLE_DOCUMENTS) expect(detectKind(d.text), d.name).toBe(d.kind);
  });

  it('extracts Form 16 salary inputs', () => {
    const out = rulesExtract(doc('doc-form16'));
    const v = (f: string) => out.facts.find((x) => x.field === f)?.amount;
    expect(v('salary.gross')).toBe(1_840_000);
    expect(v('salary.basic')).toBe(840_000);
    expect(v('salary.hraReceived')).toBe(336_000);
    expect(v('taxesPaid.tds')).toBe(246_800);
  });

  it('splits health premiums between self and senior parents', () => {
    const out = rulesExtract(doc('doc-health'));
    expect(out.facts.find((f) => f.field === 'deductions.sec80D_self')?.amount).toBe(28_500);
    expect(out.facts.find((f) => f.field === 'deductions.sec80D_parents')?.amount).toBe(32_000);
    expect(out.facts.some((f) => f.field === 'deductions.parentsSenior')).toBe(true);
  });

  it('raises the coaching-fee ambiguity', () => {
    expect(rulesExtract(doc('doc-bank')).ambiguities).toHaveLength(1);
  });
});

describe('grounding check', () => {
  const text = 'Total savings interest credited: Rs. 31,640';
  it('accepts a verbatim quote containing the value', () => {
    expect(checkGrounding(text, 'Total savings interest credited: Rs. 31,640', 31_640)).toBe(true);
  });
  it('tolerates whitespace and case differences', () => {
    expect(checkGrounding(text, 'total  savings interest credited: rs. 31,640', 31_640)).toBe(true);
  });
  it('rejects a paraphrased quote', () => {
    expect(checkGrounding(text, 'Savings interest was Rs. 31,640', 31_640)).toBe(false);
  });
  it('rejects a real quote with the wrong value (hallucinated number)', () => {
    expect(checkGrounding(text, 'Total savings interest credited: Rs. 31,640', 36_140)).toBe(false);
  });
  it('cannot verify binary documents', () => {
    expect(checkGrounding(undefined, 'anything', 1)).toBeNull();
  });

  it('caps confidence on ungrounded facts', () => {
    const output: ExtractionOutput = {
      documentType: 'bank-statement', summary: '', ambiguities: [],
      facts: [{ field: 'otherSources.savingsInterest', amount: 99_999, text: null, label: 'x', quote: 'made up', page: null, confidence: 0.97 }],
    };
    const { facts } = finalizeExtraction(output, { id: 'd', name: 'd', text }, 'llm');
    expect(facts[0].grounded).toBe(false);
    expect(facts[0].confidence).toBe(0.5);
  });
});

describe('extraction JSON schema', () => {
  it('requires every property (structured-output compatible)', () => {
    const walk = (s: Record<string, unknown>) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        const props = s.properties as Record<string, Record<string, unknown>>;
        expect(new Set(s.required as string[])).toEqual(new Set(Object.keys(props)));
        Object.values(props).forEach(walk);
      }
      if (s.type === 'array') walk(s.items as Record<string, unknown>);
    };
    walk(extractionJsonSchema);
  });
});

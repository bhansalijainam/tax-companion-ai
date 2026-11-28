import { describe, expect, it } from 'vitest';
import { reducer } from './CaseContext';
import { applyExtraction, emptyCase } from '../ai/pipeline';
import { rulesExtract } from '../ai/extraction/rulesExtractor';
import type { CaseDocument } from '../domain/types';

const doc: CaseDocument = { id: 'd1', name: 'pnl.txt', kind: 'capital-gains', mimeType: 'text/plain', size: 10, status: 'extracting', text: 'Tax P&L Statement\nShort Term Capital Gain (s.111A): Rs. 64,000' };
const applied = applyExtraction(doc, { output: rulesExtract(doc, 'capital-gains'), extractor: 'rules:v1', latencyMs: 0 });

describe('case reducer', () => {
  it('applies an extraction to a document that is still there', () => {
    const c = reducer({ ...emptyCase(), documents: [doc] }, { type: 'applyExtraction', docId: 'd1', applied });
    expect(c.facts.length).toBeGreaterThan(0);
  });

  it('drops a late extraction for a document removed while it was being read', () => {
    let c = reducer({ ...emptyCase(), documents: [doc] }, { type: 'removeDocument', id: 'd1' });
    const before = c;
    c = reducer(c, { type: 'applyExtraction', docId: 'd1', applied });
    expect(c).toBe(before);
    expect(c.facts).toHaveLength(0);
    expect(c.modelFlags).toHaveLength(0);
  });
});

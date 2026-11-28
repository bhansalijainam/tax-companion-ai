import type { CaseDocument, CaseFile, Fact, Flag } from '../domain/types.js';
import { SAMPLE_CLIENT, SAMPLE_DOCUMENTS } from '../fixtures/sampleDocuments.js';
import { finalizeExtraction } from './extraction/grounding.js';
import type { ExtractorRun } from './extraction/llmExtractor.js';
import { rulesExtract } from './extraction/rulesExtractor.js';

export interface ExtractionApplied {
  facts: Fact[];
  flags: Flag[];
  doc: Partial<CaseDocument>;
}

/** Turn an extractor run into facts/flags for a document (pure; shared by client and server). */
export function applyExtraction(doc: Pick<CaseDocument, 'id' | 'name' | 'text'>, run: ExtractorRun): ExtractionApplied {
  const origin = run.extractor.startsWith('rules') ? 'rules' : 'llm';
  const { facts, flags } = finalizeExtraction(run.output, doc, origin);
  return {
    facts,
    flags,
    doc: { status: 'extracted', kind: run.output.documentType, extractor: run.extractor, latencyMs: run.latencyMs, summary: run.output.summary },
  };
}

export function emptyCase(): CaseFile {
  return { client: { ...SAMPLE_CLIENT }, documents: [], facts: [], modelFlags: [], flagState: {}, audit: [] };
}

/**
 * The demo case: sample documents run through the rules baseline synchronously,
 * so the app opens on a populated, reviewable case without any network call.
 */
export function buildSampleCase(): CaseFile {
  const c = emptyCase();
  const now = new Date().toISOString();
  for (const d of SAMPLE_DOCUMENTS) {
    const base: CaseDocument = { id: d.id, name: d.name, kind: d.kind, mimeType: 'text/plain', size: d.text.length, text: d.text, status: 'queued' };
    const run: ExtractorRun = { output: rulesExtract(base, d.kind), extractor: 'rules:v1', latencyMs: 0 };
    const applied = applyExtraction(base, run);
    c.documents.push({ ...base, ...applied.doc } as CaseDocument);
    c.facts.push(...applied.facts);
    c.modelFlags.push(...applied.flags);
  }
  c.audit.push({ at: now, actor: 'system', action: 'case.created', detail: `Sample case loaded: ${SAMPLE_DOCUMENTS.length} documents extracted with rules:v1` });
  return c;
}

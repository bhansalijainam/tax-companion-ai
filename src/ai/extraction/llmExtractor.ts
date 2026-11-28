import type { CaseDocument } from '../../domain/types.js';
import type { Attachment, LLMProvider, Usage } from '../llm/types.js';
import { LLMError } from '../llm/types.js';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from './prompt.js';
import { ExtractionOutput, extractionJsonSchema } from './schema.js';

export interface ExtractorRun {
  output: ExtractionOutput;
  extractor: string;
  latencyMs: number;
  usage?: Usage;
  /** Set by the hybrid extractor: which path handled the document, and why */
  route?: { path: 'rules' | 'llm'; reason: string };
}

export interface Extractor {
  readonly id: string;
  extract(doc: Pick<CaseDocument, 'name' | 'text' | 'base64' | 'mimeType'>): Promise<ExtractorRun>;
}

function attachmentFor(doc: Pick<CaseDocument, 'name' | 'text' | 'base64' | 'mimeType'>): Attachment {
  if (doc.text) return { type: 'text-document', title: doc.name, text: doc.text };
  if (doc.base64 && doc.mimeType === 'application/pdf') return { type: 'pdf', title: doc.name, base64: doc.base64 };
  if (doc.base64 && /^image\/(png|jpeg|webp)$/.test(doc.mimeType)) {
    return { type: 'image', title: doc.name, base64: doc.base64, mediaType: doc.mimeType as 'image/png' };
  }
  throw new LLMError(`Unsupported document type: ${doc.mimeType}`, 'bad_request', false);
}

/** Structured-output extraction through any LLMProvider. */
export class LLMExtractor implements Extractor {
  readonly id: string;
  constructor(private provider: LLMProvider) {
    this.id = `${provider.id}:${provider.model}`;
  }

  async extract(doc: Pick<CaseDocument, 'name' | 'text' | 'base64' | 'mimeType'>): Promise<ExtractorRun> {
    const started = Date.now();
    const res = await this.provider.complete({
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', text: extractionUserPrompt(doc.name), attachments: [attachmentFor(doc)] }],
      outputSchema: extractionJsonSchema,
      effort: 'medium',
    });
    if (res.stopReason === 'refusal') throw new LLMError('The model declined to process this document', 'refusal', false);
    if (res.stopReason === 'max_tokens') throw new LLMError('Extraction output was truncated', 'unknown', true);

    let json: unknown;
    try {
      json = JSON.parse(res.text);
    } catch {
      throw new LLMError('Model returned invalid JSON', 'unknown', true);
    }
    // Defence in depth: structured outputs guarantee shape, zod enforces our ranges
    const parsed = ExtractionOutput.safeParse(json);
    if (!parsed.success) throw new LLMError(`Schema validation failed: ${parsed.error.issues[0]?.message}`, 'unknown', true);
    return { output: parsed.data, extractor: this.id, latencyMs: Date.now() - started, usage: res.usage };
  }
}

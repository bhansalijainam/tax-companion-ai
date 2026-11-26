import { z } from 'zod';
import { FACT_FIELDS } from '../src/domain/fields.js';
import type { CaseFile } from '../src/domain/types.js';

const DOC_KINDS = ['form16', 'bank-statement', 'investment-proof', 'insurance', 'loan-certificate', 'capital-gains', 'ais', 'rent-receipt', 'other'] as const;
const str = (max: number) => z.string().max(max);

/** Server-side validation of a case document before it is stored. Binaries are not accepted. */
export const CaseFileSchema = z.object({
  client: z.object({ name: str(200), pan: str(20), fy: str(10), ay: str(10), employer: str(200).optional() }),
  documents: z.array(z.object({
    id: str(100), name: str(300), kind: z.enum(DOC_KINDS), mimeType: str(100), size: z.number().nonnegative(),
    text: str(400_000).optional(), base64: z.undefined().optional(),
    status: z.enum(['queued', 'extracting', 'extracted', 'error']), error: str(2000).optional(),
    extractor: str(200).optional(), latencyMs: z.number().optional(), summary: str(2000).optional(),
  })).max(200),
  facts: z.array(z.object({
    id: str(200), docId: str(100), field: z.enum(FACT_FIELDS as [string, ...string[]]),
    value: z.union([z.number(), z.boolean(), str(200)]), label: str(500), quote: str(2000), page: z.number().optional(),
    confidence: z.number().min(0).max(1), origin: z.enum(['llm', 'rules', 'human']),
    status: z.enum(['proposed', 'accepted', 'rejected']), grounded: z.boolean().nullable(),
    originalValue: z.union([z.number(), z.boolean(), str(200)]).optional(),
  })).max(2000),
  modelFlags: z.array(z.object({
    id: str(200), source: z.enum(['rule', 'model', 'confidence', 'grounding', 'conflict']), title: str(500), detail: str(4000),
    question: str(2000), priority: z.enum(['high', 'medium', 'low']), factIds: z.array(str(200)).optional(),
    docId: str(100).optional(), amount: z.number().optional(),
  })).max(500),
  flagState: z.record(z.string(), z.object({ status: z.enum(['open', 'resolved', 'dismissed']), note: str(2000).optional(), at: str(40) })),
  audit: z.array(z.object({ at: str(40), actor: z.enum(['system', 'ai', 'ca']), action: str(100), detail: str(2000) })).max(20_000),
});

export const parseCaseFile = (v: unknown): CaseFile => CaseFileSchema.parse(v) as CaseFile;

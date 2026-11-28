import { z } from 'zod';
import { FACT_FIELDS, FactField } from '../../domain/fields.js';
import { DOC_KINDS, type DocKind } from '../../domain/types.js';

export { DOC_KINDS };

/** What any extractor (LLM or rules) returns for one document, before grounding checks. */
export const ExtractionOutput = z.object({
  documentType: z.enum(DOC_KINDS as [DocKind, ...DocKind[]]),
  summary: z.string(),
  facts: z.array(
    z.object({
      field: z.enum(FACT_FIELDS as [FactField, ...FactField[]]),
      amount: z.number().nullable(),
      text: z.string().nullable(),
      label: z.string(),
      quote: z.string(),
      page: z.number().int().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  ambiguities: z.array(
    z.object({
      description: z.string(),
      question: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      amount: z.number().nullable(),
      quote: z.string(),
    }),
  ),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutput>;

/**
 * Hand-written JSON Schema mirror of ExtractionOutput, used for the model's structured
 * output. Kept explicit (not generated) so the contract is reviewable in one place.
 */
export const extractionJsonSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'summary', 'facts', 'ambiguities'],
  properties: {
    documentType: { type: 'string', enum: DOC_KINDS },
    summary: { type: 'string', description: 'One sentence: what this document is and whose it is.' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'amount', 'text', 'label', 'quote', 'page', 'confidence'],
        properties: {
          field: { type: 'string', enum: FACT_FIELDS },
          amount: { type: ['number', 'null'], description: 'Rupees as a plain number. For boolean fields use 1 (true) or 0 (false). null for text fields.' },
          text: { type: ['string', 'null'], description: 'Only for text fields (e.g. landlord PAN); otherwise null.' },
          label: { type: 'string', description: 'Short human label for the line item, e.g. "LIC premium — policy 8812 4471 09".' },
          quote: { type: 'string', description: 'Exact, verbatim span from the document that contains the value. Copy characters exactly; do not paraphrase.' },
          page: { type: ['integer', 'null'] },
          confidence: { type: 'number', description: '0–1. Below 0.8 means a reviewer must check classification or amount.' },
        },
      },
    },
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'question', 'priority', 'amount', 'quote'],
        properties: {
          description: { type: 'string', description: 'What is unclear and why it matters for tax treatment.' },
          question: { type: 'string', description: 'Plain-language question the CA can forward to the client.' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          amount: { type: ['number', 'null'] },
          quote: { type: 'string', description: 'Verbatim span the ambiguity is about.' },
        },
      },
    },
  },
};

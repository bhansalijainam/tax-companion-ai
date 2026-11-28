import { FIELDS } from '../../domain/fields.js';
import type { CaseDocument, Fact, Flag } from '../../domain/types.js';
import type { ExtractionOutput } from './schema.js';

const normalize = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** All numbers in a string, ignoring Indian/Western thousands separators. */
export function numbersIn(s: string): number[] {
  return (s.replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * Check a model citation against the source text.
 * Returns null when the document has no text layer (cannot verify).
 */
export function checkGrounding(
  docText: string | undefined,
  quote: string,
  value: number | boolean | string,
): boolean | null {
  if (!docText) return null;
  if (!quote.trim()) return false;
  if (!normalize(docText).includes(normalize(quote))) return false;
  if (typeof value === 'number') return numbersIn(quote).some((n) => Math.abs(n - value) < 0.5);
  if (typeof value === 'string') return normalize(quote).includes(normalize(value));
  return true;
}

export const UNGROUNDED_CONFIDENCE_CAP = 0.5;

/** Turn raw extractor output into reviewable facts + flags, verifying every citation. */
export function finalizeExtraction(
  output: ExtractionOutput,
  doc: Pick<CaseDocument, 'id' | 'name' | 'text'>,
  origin: Fact['origin'],
): { facts: Fact[]; flags: Flag[] } {
  const facts: Fact[] = [];
  output.facts.forEach((f, i) => {
    const meta = FIELDS[f.field];
    let value: number | boolean | string;
    if (meta.kind === 'boolean') value = (f.amount ?? 0) >= 0.5;
    else if (meta.kind === 'text') value = f.text ?? '';
    else {
      if (f.amount === null || !Number.isFinite(f.amount)) return; // schema-valid but unusable
      value = Math.round(f.amount);
    }
    const grounded = checkGrounding(doc.text, f.quote, value);
    facts.push({
      id: `${doc.id}:f${i}`,
      docId: doc.id,
      field: f.field,
      value,
      label: f.label,
      quote: f.quote,
      page: f.page ?? undefined,
      confidence: grounded === false ? Math.min(f.confidence, UNGROUNDED_CONFIDENCE_CAP) : f.confidence,
      origin,
      status: 'proposed',
      grounded,
    });
  });

  const flags: Flag[] = output.ambiguities.map((a, i) => ({
    id: `model:${doc.id}:${i}`,
    source: 'model',
    title: a.description.length > 90 ? a.description.slice(0, 87) + '…' : a.description,
    detail: `${a.description}${a.quote ? ` — “${a.quote}”` : ''} (${doc.name})`,
    question: a.question,
    priority: a.priority,
    docId: doc.id,
    amount: a.amount ?? undefined,
  }));

  return { facts, flags };
}

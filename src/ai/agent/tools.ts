import { buildInputs, caseSummary, deriveFlags, fieldValue } from '../../domain/caseFile.js';
import { FACT_FIELDS, FactField, FIELDS } from '../../domain/fields.js';
import type { CaseFile } from '../../domain/types.js';
import { compareRegimes, deductionHeadroom, oldRegimeBreakEven } from '../../engine/compute.js';
import type { TaxInputs, TaxResult } from '../../engine/types.js';
import type { ToolSpec } from '../llm/types.js';

/** Fields a what-if may override: numeric engine inputs only. */
export const OVERRIDABLE_FIELDS = FACT_FIELDS.filter((f) => FIELDS[f].kind === 'amount' && !FIELDS[f].reconciliationOnly);

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'get_case_overview',
    description: 'Client, documents on file, review status, open-flag count and the current regime recommendation. Call this first when you need context.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: 'get_facts',
    description: 'Extracted facts with their source document, verbatim quote, confidence and review status. Filter by field prefix such as "salary", "deductions" or "otherSources".',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['field_prefix'],
      properties: { field_prefix: { type: ['string', 'null'], description: 'e.g. "deductions" or "salary.gross"; null for all facts' } },
    },
  },
  {
    name: 'compute_tax',
    description:
      'Run the deterministic FY 2024-25 tax engine. Returns tax under the requested regime(s) with the line-by-line computation. ' +
      'Use overrides for what-if questions (e.g. "what if the client adds ₹50,000 to NPS?"). This is the ONLY source of tax figures.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['regime', 'overrides'],
      properties: {
        regime: { type: 'string', enum: ['old', 'new', 'both'] },
        overrides: {
          type: 'array',
          description: 'Hypothetical changes. Empty array for the case as filed.',
          items: {
            type: 'object', additionalProperties: false, required: ['field', 'amount', 'mode'],
            properties: {
              field: { type: 'string', enum: OVERRIDABLE_FIELDS },
              amount: { type: 'number', description: 'Rupees' },
              mode: { type: 'string', enum: ['set', 'add'], description: 'set replaces the current value; add increases it' },
            },
          },
        },
      },
    },
  },
  {
    name: 'get_flags',
    description: 'Issues needing CA attention: reconciliation mismatches against AIS, missing evidence, ambiguous items raised during extraction, low-confidence facts.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['status'],
      properties: { status: { type: 'string', enum: ['open', 'all'] } },
    },
  },
  {
    name: 'search_documents',
    description: 'Keyword search over the text of the client\'s documents. Returns matching lines with document name and line number, for citing sources.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: { query: { type: 'string' } },
    },
  },
  {
    name: 'deduction_headroom',
    description: 'Unused capacity under capped old-regime deductions (80C, 80CCD(1B), 80D) and the extra deduction at which the old regime would beat the new one.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
];

const summarizeResult = (r: TaxResult) => ({
  regime: r.regime,
  totalIncome: r.totalIncome,
  totalDeductions: r.totalDeductions,
  totalTax: r.totalTax,
  taxesPaid: r.taxesPaid,
  netPayable: r.netPayable,
  computation: r.trace.filter((l) => l.amount !== 0).map((l) => ({ line: l.label, amount: l.amount, rule: l.rule, note: l.note })),
  warnings: r.warnings,
});

function applyOverrides(inputs: TaxInputs, overrides: { field: FactField; amount: number; mode: 'set' | 'add' }[]): TaxInputs {
  const next: TaxInputs = structuredClone(inputs);
  for (const o of overrides) {
    if (!OVERRIDABLE_FIELDS.includes(o.field)) throw new Error(`Field ${o.field} cannot be overridden`);
    const [head, key] = o.field.split('.') as [keyof TaxInputs, string];
    const bucket = next[head] as Record<string, number>;
    bucket[key] = o.mode === 'add' ? (bucket[key] ?? 0) + o.amount : o.amount;
  }
  return next;
}

type ToolInput = Record<string, unknown>;

export function executeTool(name: string, input: ToolInput, c: CaseFile): unknown {
  switch (name) {
    case 'get_case_overview': {
      const s = caseSummary(c);
      return {
        client: c.client,
        documents: c.documents.map((d) => ({ name: d.name, kind: d.kind, status: d.status })),
        facts: { total: c.facts.length, pendingReview: s.pendingReview, accepted: s.acceptedFacts },
        openFlags: s.openFlags.length,
        highPriorityFlags: s.openFlags.filter((f) => f.priority === 'high').map((f) => f.title),
        recommendation: {
          regime: s.comparison.recommended,
          oldRegimeTax: s.comparison.old.totalTax,
          newRegimeTax: s.comparison.new.totalTax,
          savings: s.comparison.savings,
        },
      };
    }
    case 'get_facts': {
      const prefix = typeof input.field_prefix === 'string' ? input.field_prefix : '';
      const facts = c.facts.filter((f) => f.field.startsWith(prefix));
      const fields = [...new Set(facts.map((f) => f.field))];
      return {
        totals: Object.fromEntries(fields.map((f) => [f, fieldValue(c.facts, f) ?? null])),
        facts: facts.map((f) => ({
          field: f.field,
          label: f.label,
          value: f.value,
          document: c.documents.find((d) => d.id === f.docId)?.name,
          quote: f.quote,
          confidence: f.confidence,
          status: f.status,
          citationVerified: f.grounded,
        })),
      };
    }
    case 'compute_tax': {
      const overrides = (Array.isArray(input.overrides) ? input.overrides : []) as { field: FactField; amount: number; mode: 'set' | 'add' }[];
      const inputs = applyOverrides(buildInputs(c.facts), overrides);
      const cmp = compareRegimes(inputs);
      const regime = input.regime as 'old' | 'new' | 'both';
      return {
        overridesApplied: overrides,
        ...(regime === 'both'
          ? { old: summarizeResult(cmp.old), new: summarizeResult(cmp.new), recommended: cmp.recommended, savings: cmp.savings }
          : { [regime]: summarizeResult(cmp[regime]) }),
      };
    }
    case 'get_flags': {
      const flags = deriveFlags(c).filter((f) => input.status === 'all' || f.state === 'open');
      return flags.map((f) => ({ title: f.title, priority: f.priority, source: f.source, status: f.state, amount: f.amount ?? null, detail: f.detail, clientQuestion: f.question }));
    }
    case 'search_documents': {
      const terms = String(input.query ?? '').toLowerCase().split(/\W+/).filter((t) => t.length > 2);
      const hits: { document: string; line: number; text: string; score: number }[] = [];
      for (const d of c.documents) {
        (d.text ?? '').split('\n').forEach((line, i) => {
          const l = line.toLowerCase();
          const score = terms.filter((t) => l.includes(t)).length;
          if (score > 0) hits.push({ document: d.name, line: i + 1, text: line.trim(), score });
        });
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, 6).map(({ score: _s, ...h }) => h);
    }
    case 'deduction_headroom': {
      const inputs = buildInputs(c.facts);
      const cmp = compareRegimes(inputs);
      return {
        headroom: deductionHeadroom(inputs),
        recommended: cmp.recommended,
        oldRegimeTax: cmp.old.totalTax,
        newRegimeTax: cmp.new.totalTax,
        extraDeductionForOldToWin: cmp.recommended === 'old' ? 0 : oldRegimeBreakEven(inputs),
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

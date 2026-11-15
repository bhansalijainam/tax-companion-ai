/**
 * Demo-mode provider. It implements the same LLMProvider contract as Claude, so the
 * agent loop, tools, tracing and grounding checks all run for real — only the
 * "reasoning" is a keyword router and the prose comes from templates.
 * The UI labels every answer from this provider as scripted.
 */
import type { CompletionRequest, CompletionResponse, LLMMessage, LLMProvider, ToolCall } from '../types';

const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const SECTION_FIELDS: [RegExp, string, string][] = [
  [/nps|80ccd/i, 'deductions.sec80CCD1B', 'NPS (80CCD(1B))'],
  [/80d|health|insurance|mediclaim/i, 'deductions.sec80D_self', 'health insurance (80D)'],
  [/80c|ppf|elss|lic/i, 'deductions.sec80C', '80C'],
];

type Intent = 'whatif' | 'regime' | 'flags' | 'headroom' | 'search' | 'facts' | 'overview';

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/(what if|if (the client|he|she|they|we)|invest|contribut|put|add)\b/.test(t) && /\d/.test(t)) return 'whatif';
  if (/where|which document|source|show me the line|quote|find/.test(t)) return 'search';
  if (/flag|issue|risk|missing|notice|mismatch|ais|question|follow.?up/.test(t)) return 'flags';
  if (/save|saving|headroom|deduction|plan|nps|80c|80d|reduce/.test(t)) return 'headroom';
  if (/regime|tax|liabil|recommend|compare|payable|refund|owe/.test(t)) return 'regime';
  if (/income|salary|interest|rent|capital|gain|fact|extract/.test(t)) return 'facts';
  return 'overview';
}

function parseAmount(text: string): number | null {
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l|k|thousand)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  if (unit.startsWith('l')) return n * 100_000;
  if (unit === 'k' || unit === 'thousand') return n * 1_000;
  return n;
}

let callSeq = 0;
const call = (name: string, input: Record<string, unknown>): ToolCall => ({ id: `scripted_${++callSeq}`, name, input });

function planCalls(text: string): ToolCall[] {
  switch (classifyIntent(text)) {
    case 'whatif': {
      const amount = parseAmount(text) ?? 50_000;
      const [, field] = SECTION_FIELDS.find(([re]) => re.test(text)) ?? SECTION_FIELDS[0];
      return [call('compute_tax', { regime: 'both', overrides: [] }), call('compute_tax', { regime: 'both', overrides: [{ field, amount, mode: 'add' }] })];
    }
    case 'regime': return [call('compute_tax', { regime: 'both', overrides: [] }), call('get_flags', { status: 'open' })];
    case 'flags': return [call('get_flags', { status: 'open' })];
    case 'headroom': return [call('deduction_headroom', {})];
    case 'search': {
      const q = text.replace(/where|which|document|source|show|me|the|is|are|from|find|does|come|did|we|get/gi, ' ');
      return [call('search_documents', { query: q })];
    }
    case 'facts': {
      const prefix = /salary/i.test(text) ? 'salary' : /deduct|80c|80d/i.test(text) ? 'deductions' : /interest/i.test(text) ? 'otherSources' : /capital|gain/i.test(text) ? 'capitalGains' : null;
      return [call('get_facts', { field_prefix: prefix }), call('compute_tax', { regime: 'both', overrides: [] })];
    }
    default: return [call('get_case_overview', {})];
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function compose(userText: string, results: { name: string; data: any }[]): string {
  const intent = classifyIntent(userText);
  const get = (name: string, i = 0) => results.filter((r) => r.name === name)[i]?.data;

  if (intent === 'whatif') {
    const base = get('compute_tax', 0);
    const alt = get('compute_tax', 1);
    const o = alt.overridesApplied[0];
    const [, , label] = SECTION_FIELDS.find(([, f]) => f === o.field) ?? [null, null, o.field];
    const delta = base.old.totalTax - alt.old.totalTax;
    return [
      `Adding ${inr(o.amount)} to ${label} changes old-regime tax from ${inr(base.old.totalTax)} to ${inr(alt.old.totalTax)}. New-regime tax stays at ${inr(alt.new.totalTax)} because it allows no such deduction.`,
      '',
      `| | Old regime | New regime |`,
      `|---|---|---|`,
      `| As filed | ${inr(base.old.totalTax)} | ${inr(base.new.totalTax)} |`,
      `| With ${label} | ${inr(alt.old.totalTax)} | ${inr(alt.new.totalTax)} |`,
      '',
      delta > 0
        ? `Recommended regime after the change: **${alt.recommended}**, saving ${inr(alt.savings)} over the other regime.`
        : `No benefit: this section is already at its cap, so the extra amount does not reduce tax.`,
    ].join('\n');
  }

  if (intent === 'regime') {
    const t = get('compute_tax');
    const flags = (get('get_flags') ?? []) as any[];
    const high = flags.filter((f) => f.priority === 'high');
    const rec = t.recommended as 'old' | 'new';
    const r = t[rec];
    return [
      `The **${rec} regime** is cheaper by ${inr(t.savings)}: ${inr(t.old.totalTax)} (old) vs ${inr(t.new.totalTax)} (new).`,
      '',
      `Under the ${rec} regime, taxable income is ${inr(r.totalIncome)} and, after ${inr(r.taxesPaid)} TDS, ${r.netPayable >= 0 ? `${inr(r.netPayable)} is payable` : `${inr(-r.netPayable)} is refundable`}.`,
      high.length
        ? `\nBefore filing, resolve ${high.length} high-priority flag${high.length > 1 ? 's' : ''} that could change this:\n${high.map((f) => `- ${f.title}`).join('\n')}`
        : '',
    ].join('\n');
  }

  if (intent === 'flags') {
    const flags = get('get_flags') as any[];
    if (!flags.length) return 'No open flags. Every fact is reviewed and reconciles with AIS.';
    return [
      `${flags.length} open flag${flags.length > 1 ? 's' : ''}, highest priority first:`,
      '',
      ...flags.slice(0, 8).map((f, i) => `${i + 1}. **${f.title}** (${f.priority})\n   Ask the client: ${f.clientQuestion}`),
    ].join('\n');
  }

  if (intent === 'headroom') {
    const h = get('deduction_headroom');
    const rows = (h.headroom as any[]).map((x) => `| ${x.section} | ${inr(x.claimed)} | ${inr(x.cap)} | ${inr(x.remaining)} |`);
    const tail =
      h.recommended === 'old'
        ? `The old regime already wins (${inr(h.oldRegimeTax)} vs ${inr(h.newRegimeTax)}), so unused headroom saves tax at the client's marginal rate.`
        : h.extraDeductionForOldToWin
          ? `The new regime wins today. The old regime would only win with about ${inr(h.extraDeductionForOldToWin)} of extra deductions.`
          : 'The new regime wins and no realistic amount of extra deductions changes that.';
    return ['Unused deduction capacity (old regime):', '', '| Section | Claimed | Cap | Unused |', '|---|---|---|---|', ...rows, '', tail].join('\n');
  }

  if (intent === 'search') {
    const hits = get('search_documents') as any[];
    if (!hits.length) return 'Nothing in the documents on file matches that. It may be in a document the client has not shared yet.';
    return ['Matching lines in the documents on file:', '', ...hits.map((h) => `- **${h.document}**, line ${h.line}: “${h.text}”`)].join('\n');
  }

  if (intent === 'facts') {
    const f = get('get_facts');
    const t = get('compute_tax');
    const lines = (f.facts as any[]).slice(0, 12).map((x) => `- ${x.label}: ${typeof x.value === 'number' ? inr(x.value) : String(x.value)} (${x.document}${x.status === 'proposed' ? ', unreviewed' : ''})`);
    const gti = (t[t.recommended].computation as any[]).find((l) => l.line === 'Gross total income');
    return [`Here is what the documents show:`, '', ...lines, '', gti ? `Gross total income is ${inr(gti.amount)} on the ${t.recommended}-regime basis (before Chapter VI-A deductions).` : ''].join('\n');
  }

  const o = get('get_case_overview');
  return [
    `**${o.client.name}**, FY ${o.client.fy}. ${o.documents.length} documents on file, ${o.facts.total} facts extracted (${o.facts.pendingReview} awaiting review), ${o.openFlags} open flags.`,
    '',
    `Current recommendation: **${o.recommendation.regime} regime** (${inr(o.recommendation.oldRegimeTax)} old vs ${inr(o.recommendation.newRegimeTax)} new).`,
    o.highPriorityFlags.length ? `\nHigh priority:\n${o.highPriorityFlags.map((t: string) => `- ${t}`).join('\n')}` : '',
  ].join('\n');
}

export class ScriptedProvider implements LLMProvider {
  readonly id = 'scripted';
  readonly model = 'scripted-demo';

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const last = req.messages[req.messages.length - 1];
    const lastUser = [...req.messages].reverse().find((m): m is Extract<LLMMessage, { role: 'user' }> => m.role === 'user');
    const usage = { inputTokens: 0, outputTokens: 0 };

    if (last.role === 'user') {
      return { text: '', toolCalls: planCalls(last.text), stopReason: 'tool_use', usage, model: this.model };
    }
    if (last.role === 'tool') {
      const results = last.results.map((r) => ({ name: r.name, data: r.isError ? null : JSON.parse(r.content) }));
      if (results.some((r) => r.data === null)) {
        return { text: 'One of the lookups failed, so I cannot answer reliably. Check the trace below.', toolCalls: [], stopReason: 'end', usage, model: this.model };
      }
      return { text: compose(lastUser?.text ?? '', results), toolCalls: [], stopReason: 'end', usage, model: this.model };
    }
    return { text: '', toolCalls: [], stopReason: 'end', usage, model: this.model };
  }
}

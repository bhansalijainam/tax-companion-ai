import { describe, expect, it } from 'vitest';
import { buildSampleCase } from '../pipeline.js';
import { ScriptedProvider, classifyIntent } from '../llm/providers/scripted.js';
import { runAgent } from './runAgent.js';
import { checkAnswerGrounding } from './grounding.js';
import { executeTool } from './tools.js';
import { caseSummary, deriveFlags } from '../../domain/caseFile.js';
import type { CompletionResponse, LLMProvider } from '../llm/types.js';

const sample = buildSampleCase();

describe('sample case', () => {
  it('builds tax inputs from the documents', () => {
    const { inputs } = caseSummary(sample);
    expect(inputs.salary.gross).toBe(1_840_000);
    expect(inputs.salary.rentPaid).toBe(360_000);
    expect(inputs.deductions.sec80C).toBe(100_800 + 50_000 + 40_000 + 120_000);
    expect(inputs.houseProperty.letOutLoanInterest).toBe(210_000);
  });

  it('raises the reconciliation flags a CA would', () => {
    const ids = deriveFlags(sample).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['rule:landlord-pan', 'rule:ais-deposit-interest', 'rule:ais-tds', 'rule:80c-over-cap', 'rule:cash-deposit']));
  });

  it('flags disappear when the underlying data is fixed', () => {
    const fixed = structuredClone(sample);
    fixed.facts.push({ id: 'x', docId: 'doc-form16', field: 'otherSources.depositInterest', value: 52_300, label: 'FD', quote: '', confidence: 1, origin: 'human', status: 'accepted', grounded: null });
    expect(deriveFlags(fixed).map((f) => f.id)).not.toContain('rule:ais-deposit-interest');
  });
});

describe('tools', () => {
  it('what-if overrides change old-regime tax only', () => {
    type Both = { old: { totalTax: number }; new: { totalTax: number } };
    const base = executeTool('compute_tax', { regime: 'both', overrides: [] }, sample) as Both;
    const alt = executeTool('compute_tax', { regime: 'both', overrides: [{ field: 'deductions.sec80CCD1B', amount: 50_000, mode: 'add' }] }, sample) as Both;
    expect(alt.old.totalTax).toBeLessThan(base.old.totalTax);
    expect(alt.new.totalTax).toBe(base.new.totalTax);
  });

  it('rejects overrides on reconciliation-only fields', () => {
    expect(() => executeTool('compute_tax', { regime: 'old', overrides: [{ field: 'recon.aisTds', amount: 1, mode: 'set' }] }, sample)).toThrow();
  });
});

describe('scripted agent (demo mode)', () => {
  const provider = new ScriptedProvider();
  const questions = [
    'Which regime should Rahul choose?',
    'Show me all open flags',
    'How much 80C and NPS headroom is left?',
    'What if the client invests 50000 more in NPS?',
    'Where does the rent figure come from?',
    'Summarize the salary income',
    'Give me an overview',
  ];

  for (const q of questions) {
    it(`answers "${q}" with only grounded figures`, async () => {
      const r = await runAgent(provider, sample, [], q);
      expect(r.stoppedBecause).toBe('answered');
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.steps.every((s) => !s.isError)).toBe(true);
      expect(r.grounding.amounts.filter((a) => !a.grounded)).toEqual([]);
    });
  }

  it('routes intents', () => {
    expect(classifyIntent('what if he puts 1.5 lakh in PPF')).toBe('whatif');
    expect(classifyIntent('any AIS mismatch?')).toBe('flags');
  });
});

describe('answer grounding', () => {
  it('flags a figure the model invented', () => {
    const r = checkAnswerGrounding('Tax is ₹2,40,560 and you save ₹12,345.', ['{"totalTax":240560}']);
    expect(r.ok).toBe(false);
    expect(r.amounts.find((a) => !a.grounded)?.value).toBe(12_345);
  });
  it('allows statutory limits', () => {
    expect(checkAnswerGrounding('80C is capped at ₹1,50,000.', []).ok).toBe(true);
  });
});

describe('agent loop safety', () => {
  it('stops at the step limit when the model never answers', async () => {
    const looping: LLMProvider = {
      id: 'loop', model: 'loop',
      complete: async (): Promise<CompletionResponse> => ({
        text: '', toolCalls: [{ id: 'a', name: 'get_case_overview', input: {} }], stopReason: 'tool_use', usage: { inputTokens: 0, outputTokens: 0 }, model: 'loop',
      }),
    };
    const r = await runAgent(looping, sample, [], 'hi', { maxSteps: 3 });
    expect(r.stoppedBecause).toBe('max_steps');
    expect(r.steps).toHaveLength(3);
  });

  it('never replays history starting with an assistant turn', async () => {
    let first: string | undefined;
    const spy: LLMProvider = {
      id: 'spy', model: 'spy',
      complete: async (req): Promise<CompletionResponse> => {
        first = req.messages[0].role;
        return { text: 'ok', toolCalls: [], stopReason: 'end', usage: { inputTokens: 0, outputTokens: 0 }, model: 'spy' };
      },
    };
    const history = Array.from({ length: 11 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `t${i}` }));
    await runAgent(spy, sample, history, 'next');
    expect(first).toBe('user');
  });

  it('returns tool errors to the model instead of crashing', async () => {
    let n = 0;
    const bad: LLMProvider = {
      id: 'bad', model: 'bad',
      complete: async (): Promise<CompletionResponse> =>
        n++ === 0
          ? { text: '', toolCalls: [{ id: 'a', name: 'no_such_tool', input: {} }], stopReason: 'tool_use', usage: { inputTokens: 0, outputTokens: 0 }, model: 'bad' }
          : { text: 'done', toolCalls: [], stopReason: 'end', usage: { inputTokens: 0, outputTokens: 0 }, model: 'bad' },
    };
    const r = await runAgent(bad, sample, [], 'hi');
    expect(r.steps[0].isError).toBe(true);
    expect(r.answer).toBe('done');
  });
});

/**
 * Eval runner.
 *
 *   npm run evals                                  # rules baseline + scripted agent (no key needed)
 *   npm run evals -- --extractor anthropic         # Claude extraction (needs ANTHROPIC_API_KEY)
 *   npm run evals -- --agent anthropic             # Claude agent
 *
 * Results are written to evals/results/latest.json (one entry per system, replaced on
 * re-run) and rendered on the Evals page of the app.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AGENT_CASES } from '../evals/datasets/agent';
import { EXTRACTION_CASES } from '../evals/datasets/extraction';
import { aggregate, scoreCase, CaseScore } from '../evals/score';
import { runAgent } from '../src/ai/agent/runAgent';
import { LLMExtractor, Extractor } from '../src/ai/extraction/llmExtractor';
import { RulesExtractor } from '../src/ai/extraction/rulesExtractor';
import { AnthropicProvider } from '../src/ai/llm/providers/anthropic';
import { ScriptedProvider } from '../src/ai/llm/providers/scripted';
import type { LLMProvider } from '../src/ai/llm/types';
import { applyExtraction, buildSampleCase } from '../src/ai/pipeline';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const OUT = 'evals/results/latest.json';

interface ResultsFile {
  generatedAt: string;
  extraction: Record<string, { system: string; ranAt: string; overall: ReturnType<typeof aggregate>; bySplit: Record<string, ReturnType<typeof aggregate>>; cases: CaseScore[] }>;
  agent: Record<string, { system: string; ranAt: string; passRate: number; groundedRate: number; meanSteps: number; cases: unknown[] }>;
}

function load(): ResultsFile {
  if (existsSync(OUT)) return JSON.parse(readFileSync(OUT, 'utf8'));
  return { generatedAt: '', extraction: {}, agent: {} };
}

function makeProvider(name: string): LLMProvider {
  if (name === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      console.error('ANTHROPIC_API_KEY is not set.');
      process.exit(1);
    }
    return new AnthropicProvider(process.env.LLM_MODEL || undefined);
  }
  if (name === 'scripted') return new ScriptedProvider();
  throw new Error(`Unknown provider ${name}`);
}

async function evalExtraction(extractor: Extractor) {
  const scores: CaseScore[] = [];
  for (const c of EXTRACTION_CASES) {
    const doc = { id: c.id, name: c.name, text: c.text, mimeType: 'text/plain' };
    try {
      const run = await extractor.extract(doc);
      const applied = applyExtraction(doc, run);
      scores.push(scoreCase(c, {
        kind: run.output.documentType,
        facts: applied.facts,
        ambiguities: run.output.ambiguities.map((a) => `${a.description} ${a.quote}`),
        latencyMs: run.latencyMs,
      }));
    } catch (e) {
      const s = scoreCase(c, { kind: 'error', facts: [], ambiguities: [], latencyMs: 0 });
      scores.push({ ...s, error: e instanceof Error ? e.message : String(e) });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  const bySplit = Object.fromEntries(
    [...new Set(scores.map((s) => s.split))].map((split) => [split, aggregate(scores.filter((s) => s.split === split))]),
  );
  return { overall: aggregate(scores), bySplit, cases: scores };
}

async function evalAgent(provider: LLMProvider) {
  const caseFile = buildSampleCase();
  const cases = [];
  for (const c of AGENT_CASES) {
    const started = Date.now();
    try {
      const r = await runAgent(provider, caseFile, [], c.question);
      const tools = r.steps.map((s) => s.tool);
      const mustMention = c.mustMention(caseFile);
      const missing = mustMention.filter((m) => !r.answer.toLowerCase().includes(m.toLowerCase()));
      const toolOk = c.expectTools.some((t) => tools.includes(t));
      cases.push({
        id: c.id, question: c.question, pass: toolOk && missing.length === 0 && r.grounding.ok,
        toolOk, missing, grounded: r.grounding.ok, ungrounded: r.grounding.amounts.filter((a) => !a.grounded).map((a) => a.text),
        tools, steps: r.steps.length, latencyMs: Date.now() - started, usage: r.usage, answer: r.answer,
      });
    } catch (e) {
      cases.push({ id: c.id, question: c.question, pass: false, error: e instanceof Error ? e.message : String(e), steps: 0, grounded: false });
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  const n = cases.length || 1;
  return {
    passRate: cases.filter((c) => c.pass).length / n,
    groundedRate: cases.filter((c) => c.grounded).length / n,
    meanSteps: cases.reduce((s, c) => s + (c.steps ?? 0), 0) / n,
    cases,
  };
}

async function main() {
  const results = load();
  const now = new Date().toISOString();
  const extractorName = arg('extractor') ?? (arg('agent') ? undefined : 'rules');
  const agentName = arg('agent') ?? (arg('extractor') ? undefined : 'scripted');

  if (extractorName) {
    const extractor = extractorName === 'rules' ? new RulesExtractor() : new LLMExtractor(makeProvider(extractorName));
    console.log(`Extraction eval: ${extractor.id} on ${EXTRACTION_CASES.length} documents`);
    const r = await evalExtraction(extractor);
    results.extraction[extractorName] = { system: extractor.id, ranAt: now, ...r };
    const o = r.overall;
    console.log(`  precision ${(o.precision * 100).toFixed(1)}%  recall ${(o.recall * 100).toFixed(1)}%  F1 ${(o.f1 * 100).toFixed(1)}%  forbidden ${o.forbiddenHits}`);
    for (const [split, a] of Object.entries(r.bySplit)) console.log(`  ${split.padEnd(12)} recall ${(a.recall * 100).toFixed(1)}%  precision ${(a.precision * 100).toFixed(1)}%`);
  }

  if (agentName) {
    const provider = makeProvider(agentName);
    console.log(`Agent eval: ${provider.id}:${provider.model} on ${AGENT_CASES.length} questions`);
    const r = await evalAgent(provider);
    results.agent[agentName] = { system: `${provider.id}:${provider.model}`, ranAt: now, ...r };
    console.log(`  pass ${(r.passRate * 100).toFixed(0)}%  grounded ${(r.groundedRate * 100).toFixed(0)}%  mean steps ${r.meanSteps.toFixed(1)}`);
  }

  results.generatedAt = now;
  mkdirSync('evals/results', { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

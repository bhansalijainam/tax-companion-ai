import results from '../../../evals/results/latest.json';
import { PageHeader } from '@/components/common';
import { cn } from '@/lib/utils';

type Agg = { cases: number; precision: number; recall: number; f1: number; docTypeAccuracy: number; groundedRate: number | null; ambiguityRecall: number | null; forbiddenHits: number; errors: number; meanLatencyMs: number };
type ExtractionRun = { system: string; ranAt: string; overall: Agg; bySplit: Record<string, Agg>; cases: { id: string; split: string; tp: number; fp: number; fn: number; missed: { field: string; value: unknown }[]; extra: { field: string; value: unknown }[]; error?: string }[] };
type AgentRun = { system: string; ranAt: string; passRate: number; groundedRate: number; meanSteps: number; cases: { id: string; question: string; pass: boolean; tools?: string[]; missing?: string[]; ungrounded?: string[]; error?: string }[] };

type Routing = { llmShare: number; bySplit: Record<string, { docs: number; toLlm: number }>; cases: { id: string; split: string; path: string; reason: string }[] };
const data = results as unknown as { generatedAt: string; extraction: Record<string, ExtractionRun>; agent: Record<string, AgentRun>; routing?: Routing };
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`);
const SPLITS = ['template', 'variant', 'adversarial'];

function NotRun({ cmd, what }: { cmd: string; what: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      {what} has not been run in this build (it needs an API key). Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{cmd}</code> and redeploy to publish the numbers here.
    </div>
  );
}

export function EvalsView() {
  const extraction = Object.values(data.extraction);
  const agent = Object.values(data.agent);
  const hasLlmExtraction = extraction.some((r) => !r.system.startsWith('rules'));
  const hasLlmAgent = agent.some((r) => !r.system.startsWith('scripted'));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Evals"
        subtitle="How we know it works. Extraction is scored field-by-field against hand-labelled documents; the agent is scored on whether it calls the right tools, states the engine's figures, and invents none. Results are produced by npm run evals and committed with the build."
      />

      <section className="stat-card overflow-x-auto">
        <h3 className="font-semibold">Extraction — {extraction[0]?.overall.cases ?? 0} labelled documents</h3>
        <p className="text-xs text-muted-foreground mb-4">
          <strong>Template</strong>: the demo pack (layouts the rules were written for). <strong>Variant</strong>: other issuers' formats. <strong>Adversarial</strong>: a statement with an embedded prompt injection.
          “Forbidden” counts double-counted or injected values.
        </p>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 font-medium">System</th>
              {SPLITS.map((s) => <th key={s} className="py-2 font-medium capitalize">{s} recall</th>)}
              <th className="py-2 font-medium">Precision</th><th className="py-2 font-medium">F1</th><th className="py-2 font-medium">Citations verified</th><th className="py-2 font-medium">Forbidden</th><th className="py-2 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody className="number-tabular">
            {extraction.map((r) => (
              <tr key={r.system} className="border-b border-border/50">
                <td className="py-2 font-medium">{r.system}</td>
                {SPLITS.map((s) => (
                  <td key={s} className={cn('py-2', (r.bySplit[s]?.recall ?? 1) < 0.5 && 'text-destructive')}>{pct(r.bySplit[s]?.recall)}</td>
                ))}
                <td className="py-2">{pct(r.overall.precision)}</td>
                <td className="py-2">{pct(r.overall.f1)}</td>
                <td className="py-2">{pct(r.overall.groundedRate)}</td>
                <td className="py-2">{r.overall.forbiddenHits}</td>
                <td className="py-2">{r.overall.meanLatencyMs < 50 ? '<50ms' : `${(r.overall.meanLatencyMs / 1000).toFixed(1)}s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!hasLlmExtraction && <div className="mt-4"><NotRun what="The Claude extraction eval" cmd="npm run evals -- --extractor anthropic" /></div>}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Per-document misses</summary>
          {extraction.map((r) => (
            <div key={r.system} className="mt-3">
              <p className="font-medium">{r.system}</p>
              <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                {r.cases.filter((c) => c.fn || c.fp || c.error).map((c) => (
                  <li key={c.id}>
                    <span className="font-mono">{c.id}</span> ({c.split}):{' '}
                    {c.error ? `error — ${c.error}` : `${c.tp} correct, ${c.fn} missed${c.missed.length ? ` [${c.missed.map((m) => m.field).join(', ')}]` : ''}, ${c.fp} extra${c.extra.length ? ` [${c.extra.map((m) => m.field).join(', ')}]` : ''}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </section>

      {data.routing && (
        <section className="stat-card overflow-x-auto">
          <h3 className="font-semibold">Cost routing — regex first, LLM on demand</h3>
          <p className="text-xs text-muted-foreground mb-4">
            The hybrid extractor runs the free rules path first and calls the model only when rules miss a field every document of that type must contain
            (e.g. gross salary and TDS for a Form 16). On this set, <strong>{Math.round((1 - data.routing.llmShare) * 100)}% of documents need no LLM call</strong>,
            and every one that rules handle scores 100% above. Enable with <code className="bg-muted px-1.5 py-0.5 rounded text-xs">EXTRACTION_STRATEGY=hybrid</code> once
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs ml-1">npm run evals -- --extractor hybrid</code> matches the full-LLM run.
          </p>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">Split</th><th className="py-2 font-medium">Documents</th><th className="py-2 font-medium">Handled by rules</th><th className="py-2 font-medium">Sent to LLM</th>
              </tr>
            </thead>
            <tbody className="number-tabular">
              {Object.entries(data.routing.bySplit).map(([split, r]) => (
                <tr key={split} className="border-b border-border/50">
                  <td className="py-2 capitalize">{split}</td><td className="py-2">{r.docs}</td><td className="py-2">{r.docs - r.toLlm}</td><td className="py-2">{r.toLlm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Routing reasons</summary>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              {data.routing.cases.map((c) => <li key={c.id}><span className="font-mono">{c.id}</span> → <strong>{c.path}</strong>: {c.reason}</li>)}
            </ul>
          </details>
        </section>
      )}

      <section className="stat-card overflow-x-auto">
        <h3 className="font-semibold">Assistant — {agent[0]?.cases.length ?? 0} questions on the demo case</h3>
        <p className="text-xs text-muted-foreground mb-4">
          A question passes if the expected tool was called, the answer contains the figures the engine produces, and every ₹ amount traces to a tool result.
          The scripted provider passes by construction: its row tests the harness and tools, not language quality.
        </p>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 font-medium">System</th><th className="py-2 font-medium">Pass rate</th><th className="py-2 font-medium">No invented figures</th><th className="py-2 font-medium">Mean tool calls</th>
            </tr>
          </thead>
          <tbody className="number-tabular">
            {agent.map((r) => (
              <tr key={r.system} className="border-b border-border/50">
                <td className="py-2 font-medium">{r.system}</td>
                <td className="py-2">{pct(r.passRate)}</td>
                <td className="py-2">{pct(r.groundedRate)}</td>
                <td className="py-2">{r.meanSteps.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!hasLlmAgent && <div className="mt-4"><NotRun what="The Claude agent eval" cmd="npm run evals -- --agent anthropic" /></div>}
      </section>

      <section className="stat-card">
        <h3 className="font-semibold">Tax engine</h3>
        <p className="text-sm text-muted-foreground mt-1">
          23 unit tests with hand-computed expected values: slab boundaries, s.87A rebate and marginal relief, surcharge marginal relief at ₹50L, HRA's three limbs,
          house-property loss caps per regime, s.111A/112A special rates with the basic-exemption shortfall, and the regime break-even search. Run with <code className="bg-muted px-1.5 py-0.5 rounded text-xs">npm test</code>.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">Results generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-IN') : '—'}.</p>
    </div>
  );
}

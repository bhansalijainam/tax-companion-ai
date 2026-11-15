import { ArrowDown, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { useCase } from '@/state/CaseContext';

const Box = ({ title, body, tone }: { title: string; body: string; tone?: 'ai' | 'det' | 'human' }) => {
  const cls = tone === 'ai' ? 'border-accent/50 bg-accent/5' : tone === 'det' ? 'border-primary/30 bg-primary/5' : tone === 'human' ? 'border-success/40 bg-success/5' : 'border-border bg-muted/40';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </div>
  );
};

const Arrow = () => (
  <div className="flex items-center justify-center text-muted-foreground">
    <ArrowRight className="w-4 h-4 hidden md:block" />
    <ArrowDown className="w-4 h-4 md:hidden" />
  </div>
);

const PRINCIPLES = [
  ['The model never does arithmetic', 'Tax figures come only from a tested, deterministic engine. The assistant calls it through compute_tax, including for what-ifs.'],
  ['Every fact carries evidence', 'Extraction must return a verbatim quote per fact. Code checks the quote exists in the document and contains the value; failures are capped at 50% confidence and flagged as possible hallucinations.'],
  ['Every answer is figure-checked', 'Each ₹ amount in an assistant answer must appear in a tool result, the user\'s message, or the statute. Anything else is shown as "untraced".'],
  ['Humans decide', 'Facts are proposed, not applied silently. The CA accepts, edits or rejects; edits are kept in the audit trail and the working paper stays DRAFT until review is done.'],
  ['Deterministic rules where rules suffice', 'AIS reconciliation, thresholds (landlord PAN, cash deposits) and caps are code, not prompts. They re-run on every change and clear themselves when data is fixed.'],
  ['Provider-agnostic, measured', 'Product code depends on a small LLMProvider interface. Claude is one adapter; a scripted adapter powers demo mode. Changes are judged on the eval set, not on vibes.'],
];

export function ArchitectureView() {
  const { status } = useCase();
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="How it works"
        subtitle="An applied-AI pattern for a regulated workflow: use the LLM where judgement over messy input pays off (reading documents, understanding questions), and keep it out of everything that must be exact."
      />

      <section className="stat-card space-y-3">
        <h3 className="font-semibold">Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-2 items-stretch">
          <Box title="Client documents" body="Form 16, AIS, bank statements, receipts — PDF, image or text." />
          <Arrow />
          <Box tone="ai" title="Extraction (LLM)" body="Structured output against a fixed field catalogue. Quote + confidence per fact; ambiguities become client questions." />
          <Arrow />
          <Box tone="det" title="Verify & reconcile (code)" body="Citation check, schema validation, AIS vs documents, thresholds, conflicts between documents." />
          <Arrow />
          <Box tone="human" title="CA review" body="Accept / edit / reject facts; resolve flags; draft client email." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-stretch">
          <Box tone="det" title="Tax engine (code)" body="FY 2024-25 old vs new regime: slabs, 87A, surcharge relief, HRA, HP loss caps, 111A/112A. Line-by-line trace with sections." />
          <Arrow />
          <Box tone="ai" title="Assistant (LLM + tools)" body="Bounded tool loop over six read-only tools. Answers cite documents; ₹ figures checked against tool output." />
          <Arrow />
          <Box tone="human" title="Working paper" body="Deterministic memo: conclusion, computation, evidence index, resolutions, audit trail." />
        </div>
        <p className="text-xs text-muted-foreground">Teal = model · blue = deterministic code · green = human decision.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRINCIPLES.map(([t, b]) => (
          <div key={t} className="stat-card">
            <p className="font-semibold text-sm">{t}</p>
            <p className="text-sm text-muted-foreground mt-1">{b}</p>
          </div>
        ))}
      </section>

      <section className="stat-card text-sm space-y-2">
        <h3 className="font-semibold">Running it live</h3>
        <p className="text-muted-foreground">
          Current server status: {status === null ? 'checking…' : status.live ? `live (${status.provider} / ${status.model})` : 'no model configured — demo mode'}.
        </p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Set <code className="bg-muted px-1 rounded">ANTHROPIC_API_KEY</code> in <code className="bg-muted px-1 rounded">.env.local</code> (or in your Vercel project settings).</li>
          <li><code className="bg-muted px-1 rounded">npm run dev</code> — Vite serves the same handlers as the Vercel functions at <code className="bg-muted px-1 rounded">/api/*</code>. The key stays server-side.</li>
          <li>Optional: <code className="bg-muted px-1 rounded">LLM_MODEL</code> to change model, <code className="bg-muted px-1 rounded">ACCESS_TOKEN</code> to password-protect a public deployment.</li>
        </ol>
        <p className="text-muted-foreground">Design notes, the eval method, and the FDE engagement documents (discovery, rollout, runbook, security) are in the repository's <code className="bg-muted px-1 rounded">docs/</code> folder.</p>
      </section>
    </div>
  );
}

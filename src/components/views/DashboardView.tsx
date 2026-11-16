import { ArrowRight, CheckCircle2, Circle, FileStack, ListChecks, AlertTriangle, Calculator, FileDown } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { PageHeader, PriorityBadge, Stat } from '@/components/common';
import { inr } from '@/lib/formatters';
import type { Section } from '@/components/nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardView({ go }: { go: (s: Section) => void }) {
  const { caseFile, summary, mode } = useCase();
  const { comparison: cmp, openFlags, pendingReview } = summary;
  const rec = cmp[cmp.recommended];
  const extracted = caseFile.documents.filter((d) => d.status === 'extracted').length;
  const high = openFlags.filter((f) => f.priority === 'high');

  const steps: { id: Section; label: string; icon: typeof FileStack; done: boolean; detail: string }[] = [
    { id: 'documents', label: 'Collect & extract', icon: FileStack, done: extracted > 0 && extracted === caseFile.documents.length, detail: `${extracted}/${caseFile.documents.length} documents extracted` },
    { id: 'review', label: 'Review facts', icon: ListChecks, done: caseFile.facts.length > 0 && pendingReview === 0, detail: pendingReview ? `${pendingReview} awaiting review` : 'All facts reviewed' },
    { id: 'flags', label: 'Resolve flags', icon: AlertTriangle, done: openFlags.length === 0, detail: openFlags.length ? `${openFlags.length} open (${high.length} high)` : 'No open flags' },
    { id: 'tax', label: 'Compute & compare', icon: Calculator, done: pendingReview === 0 && openFlags.length === 0, detail: `${cmp.recommended} regime · ${inr(rec.totalTax)}` },
    { id: 'report', label: 'Working paper', icon: FileDown, done: false, detail: 'Sign-off memo for the file' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Case overview"
        subtitle={`${caseFile.client.name} · FY ${caseFile.client.fy}${caseFile.client.employer ? ` · ${caseFile.client.employer}` : ''}. AI extracts and reconciles; every figure comes from the deterministic tax engine; the CA reviews and signs off.`}
        actions={<Button onClick={() => go('chat')}>Ask the assistant <ArrowRight className="w-4 h-4" /></Button>}
      />

      {mode === 'demo' && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Demo mode.</strong> Documents were read by the rules baseline and the assistant is scripted. The pipeline, tools, tax engine and checks are the same ones live mode uses. Add an API key to switch to Claude (see <button className="underline" onClick={() => go('architecture')}>How it works</button>).
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Gross total income" value={inr(rec.grossTotalIncome)} sub="From extracted facts, before deductions" />
        <Stat label="Recommended regime" value={cmp.recommended === 'old' ? 'Old regime' : 'New regime'} sub={`Saves ${inr(cmp.savings)} vs the other`} tone="accent" />
        <Stat label={rec.netPayable >= 0 ? 'Tax payable' : 'Refund due'} value={inr(Math.abs(rec.netPayable))} sub={`Liability ${inr(rec.totalTax)} − TDS ${inr(rec.taxesPaid)}`} tone={rec.netPayable >= 0 ? undefined : 'good'} />
        <Stat label="Open flags" value={String(openFlags.length)} sub={`${high.length} high priority · ${pendingReview} facts unreviewed`} tone={openFlags.length ? 'warn' : 'good'} />
      </div>

      <div className="stat-card">
        <h3 className="font-semibold mb-4">Workflow</h3>
        <ol className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button onClick={() => go(s.id)} className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors h-full">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.done ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Circle className="w-4 h-4" />}
                  Step {i + 1}
                </div>
                <p className="font-medium text-sm mt-1">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Regime comparison</h3>
            <button className="text-xs text-accent hover:underline" onClick={() => go('tax')}>Full computation →</button>
          </div>
          <div className="space-y-3">
            {(['old', 'new'] as const).map((r) => (
              <div key={r} className={cn('flex justify-between items-center p-4 rounded-lg', cmp.recommended === r ? 'bg-accent/10 border-2 border-accent' : 'bg-muted/50')}>
                <div>
                  <p className="font-medium">{r === 'old' ? 'Old regime' : 'New regime (default)'}</p>
                  <p className="text-xs text-muted-foreground">Taxable income {inr(cmp[r].totalIncome)}</p>
                </div>
                <p className={cn('text-xl font-bold number-tabular', cmp.recommended === r && 'text-accent')}>{inr(cmp[r].totalTax)}</p>
              </div>
            ))}
          </div>
          {pendingReview > 0 && <p className="text-xs text-muted-foreground mt-3">Provisional: includes {pendingReview} facts not yet reviewed.</p>}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Needs attention</h3>
            <button className="text-xs text-accent hover:underline" onClick={() => go('flags')}>All flags →</button>
          </div>
          {openFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing open. Ready for the working paper.</p>
          ) : (
            <ul className="space-y-3">
              {openFlags.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm">{f.title}</p>
                  <PriorityBadge priority={f.priority} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

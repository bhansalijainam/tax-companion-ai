import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { PageHeader } from '@/components/common';
import { inr } from '@/lib/formatters';
import type { Section } from '@/components/nav';
import { deductionHeadroom, oldRegimeBreakEven } from '@/engine/compute';
import type { TaxResult } from '@/engine/types';
import { FY } from '@/engine/rules';
import { cn } from '@/lib/utils';

function Trace({ result, recommended }: { result: TaxResult; recommended: boolean }) {
  return (
    <div className={cn('stat-card', recommended && 'border-2 border-accent')}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{result.regime === 'old' ? 'Old regime' : 'New regime (s.115BAC)'}</h3>
        {recommended && (
          <span className="section-badge bg-accent/10 text-accent"><CheckCircle className="w-3 h-3 mr-1" /> Lower tax</span>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {result.trace.map((l) => (
            <tr key={l.key} className={cn('border-b border-border/40 last:border-0', (l.kind === 'subtotal' || l.kind === 'total') && 'font-semibold')}>
              <td className="py-1.5 pr-2">
                <span className={cn(l.kind === 'deduction' || l.kind === 'credit' ? 'pl-3 text-muted-foreground' : '')}>{l.label}</span>
                {l.rule && <span className="ml-2 text-[10px] text-muted-foreground font-mono">{l.rule}</span>}
                {l.note && <p className="pl-3 text-[11px] text-muted-foreground font-normal">{l.note}</p>}
              </td>
              <td className={cn('py-1.5 text-right number-tabular whitespace-nowrap align-top', l.amount < 0 && 'text-muted-foreground', l.kind === 'total' && 'text-base')}>
                {inr(l.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.warnings.map((w) => (
        <p key={w} className="mt-3 text-xs text-warning flex gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {w}</p>
      ))}
    </div>
  );
}

export function TaxCalculationView({ go }: { go: (s: Section) => void }) {
  const { summary } = useCase();
  const { comparison: cmp, inputs, pendingReview, openFlags } = summary;
  const headroom = deductionHeadroom(inputs);
  const breakEven = cmp.recommended === 'new' ? oldRegimeBreakEven(inputs) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tax computation"
        subtitle={`Deterministic engine, FY ${FY} rules (Finance (No. 2) Act 2024). Every line shows its section. The AI never produces these numbers — it can only call this engine.`}
      />

      {(pendingReview > 0 || openFlags.length > 0) && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <span>
            Provisional. {pendingReview > 0 && <><button className="underline" onClick={() => go('review')}>{pendingReview} facts</button> not yet reviewed. </>}
            {openFlags.length > 0 && <><button className="underline" onClick={() => go('flags')}>{openFlags.length} open flags</button> could change the result.</>}
          </span>
        </div>
      )}

      <div className="stat-card bg-gradient-to-r from-success/10 to-accent/10 border-success/30">
        <p className="text-sm text-muted-foreground">Recommendation</p>
        <p className="text-xl font-semibold mt-1">
          {cmp.recommended === 'old' ? 'Old regime' : 'New regime'} saves <span className="text-success">{inr(cmp.savings)}</span>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {inr(cmp.old.totalTax)} under the old regime vs {inr(cmp.new.totalTax)} under the new regime.
          {cmp.recommended === 'old' && ' Salaried taxpayers opt out of the default regime in the return itself (no Form 10-IEA needed without business income).'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Trace result={cmp.old} recommended={cmp.recommended === 'old'} />
        <Trace result={cmp.new} recommended={cmp.recommended === 'new'} />
      </div>

      <div className="stat-card">
        <h3 className="font-semibold mb-1">Planning: unused old-regime deductions</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {cmp.recommended === 'old'
            ? 'The old regime already wins, so each rupee of unused headroom saves tax at the marginal rate.'
            : breakEven ? `The old regime would need about ${inr(breakEven)} more in deductions to win.` : 'No realistic amount of extra deductions makes the old regime cheaper.'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {headroom.map((h) => (
            <div key={h.section} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{h.section}</p>
              <p className="font-semibold number-tabular">{inr(h.remaining)} <span className="text-xs font-normal text-muted-foreground">unused</span></p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, (h.claimed / h.cap) * 100)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{inr(Math.min(h.claimed, h.cap))} of {inr(h.cap)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

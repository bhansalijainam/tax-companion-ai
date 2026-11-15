import { CheckCircle2, CircleHelp, ShieldAlert, Sparkles, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCase } from '@/state/CaseContext';
import { Switch } from '@/components/ui/switch';

export const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-sm max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.9 ? 'bg-success' : value >= 0.8 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2 min-w-[84px]" title={`Confidence ${pct}%`}>
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function GroundingBadge({ grounded }: { grounded: boolean | null }) {
  if (grounded === true)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success" title="Quote found verbatim in the document and contains the value">
        <CheckCircle2 className="w-3.5 h-3.5" /> verified
      </span>
    );
  if (grounded === false)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title="Quote not found in the document, or it does not contain the value">
        <ShieldAlert className="w-3.5 h-3.5" /> not found
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="No text layer to verify against (PDF/image) or entered manually">
      <CircleHelp className="w-3.5 h-3.5" /> unverified
    </span>
  );
}

export function OriginBadge({ origin }: { origin: 'llm' | 'rules' | 'human' }) {
  const map = {
    llm: { label: 'AI', cls: 'bg-accent/15 text-accent' },
    rules: { label: 'Rules', cls: 'bg-muted text-muted-foreground' },
    human: { label: 'CA', cls: 'bg-primary/10 text-primary' },
  } as const;
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[origin].cls)}>{map[origin].label}</span>;
}

export function PriorityBadge({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const cls = { high: 'bg-destructive/10 text-destructive', medium: 'bg-warning/15 text-[hsl(30_80%_35%)] dark:text-warning', low: 'bg-muted text-muted-foreground' }[priority];
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', cls)}>{priority}</span>;
}

/** Live/demo indicator with a switch to force demo mode when live is available. */
export function ModeIndicator({ compact = false }: { compact?: boolean }) {
  const { status, mode, preferDemo, setPreferDemo } = useCase();
  const live = mode === 'live';
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          live ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground',
        )}
        title={live ? `Live: ${status?.provider} / ${status?.model}` : 'Demo mode: rules extractor + scripted assistant, no API key needed'}
      >
        {live ? <Sparkles className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
        {live ? (compact ? 'Live AI' : `Live · ${status?.model}`) : 'Demo mode'}
      </span>
      {status?.live && !compact && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch checked={!preferDemo} onCheckedChange={(v) => setPreferDemo(!v)} aria-label="Use live AI" />
          live
        </label>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'accent' }) {
  const toneCls = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'accent' ? 'text-accent' : '';
  return (
    <div className="stat-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-1 number-tabular', toneCls)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

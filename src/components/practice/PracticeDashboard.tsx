import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { STAGE_LABEL, type ChecklistSummary, type Stage } from '@/domain/checklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { maskPan } from '@/lib/formatters';
import { ReadyBar, ReminderDialog, StageBadge } from './parts';

export interface DashboardRow {
  id: string;
  name: string;
  pan: string | null;
  fy: string;
  summary: ChecklistSummary;
  updatedAt: string;
  href: string;
}


const FILTERS: (Stage | 'all')[] = ['all', 'not-started', 'awaiting-docs', 'needs-review', 'ready', 'filed'];
const ORDER: Record<Stage, number> = { 'awaiting-docs': 0, 'not-started': 1, 'needs-review': 2, ready: 3, filed: 4 };

/** What a partner checks every morning: who still owes documents, who needs review, who is ready. */
export function PracticeDashboard({
  rows, firmName, onRemind, emptyHint,
}: {
  rows: DashboardRow[] | null;
  firmName?: string;
  /** Called after a reminder is copied or opened in WhatsApp (for the audit trail) */
  onRemind?: (row: DashboardRow, channel: 'whatsapp' | 'copy') => void;
  emptyHint?: string;
}) {
  const [filter, setFilter] = useState<Stage | 'all'>('all');
  const [q, setQ] = useState('');
  const [reminding, setReminding] = useState<DashboardRow | null>(null);

  const counts = useMemo(() => {
    const c: Record<Stage | 'all', number> = { all: 0, 'not-started': 0, 'awaiting-docs': 0, 'needs-review': 0, ready: 0, filed: 0 };
    for (const r of rows ?? []) { c.all++; c[r.summary.stage]++; }
    return c;
  }, [rows]);

  const missingDocs = (rows ?? []).reduce((s, r) => s + r.summary.items.filter((i) => i.status === 'missing' && !i.optional).length, 0);

  const visible = useMemo(
    () => (rows ?? [])
      .filter((r) => filter === 'all' || r.summary.stage === filter)
      .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => ORDER[a.summary.stage] - ORDER[b.summary.stage] || a.summary.readyPct - b.summary.readyPct),
    [rows, filter, q],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Clients this season" value={counts.all} sub={`${counts.filed} filed`} />
        <Tile label="Waiting on clients" value={counts['awaiting-docs'] + counts['not-started']} sub={`${missingDocs} documents outstanding`} tone="warn" />
        <Tile label="Needs your review" value={counts['needs-review']} sub="Figures or questions open" tone="accent" />
        <Tile label="Ready to file" value={counts.ready} sub="Waiting for sign-off" tone="good" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Filter by stage">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {f === 'all' ? 'All' : STAGE_LABEL[f]} <span className="opacity-70 number-tabular">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        {rows === null ? (
          <p className="p-5 text-sm text-muted-foreground">Loading clients…</p>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="font-medium">{rows.length === 0 ? 'No clients yet' : 'No clients match.'}</p>
            {rows.length === 0 && emptyHint && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((r) => {
              const missing = r.summary.items.filter((i) => i.status === 'missing' && !i.optional);
              const canRemind = missing.length > 0 || r.summary.items.some((i) => i.status === 'issue' && i.note?.startsWith('Could not'));
              return (
                <li key={r.id} className="group flex flex-col gap-3 px-4 py-3.5 sm:px-5 md:flex-row md:items-center hover:bg-muted/40">
                  <Link to={r.href} className="flex-1 min-w-0 flex flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
                    <div className="min-w-0 md:w-56 flex-shrink-0">
                      <p className="font-medium truncate group-hover:underline">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{maskPan(r.pan)} · FY {r.fy}</p>
                    </div>
                    <div className="flex items-center gap-3 md:w-64 flex-shrink-0">
                      <StageBadge stage={r.summary.stage} />
                      <div className="flex-1"><ReadyBar pct={r.summary.readyPct} stage={r.summary.stage} /></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <DocDots items={r.summary.items} />
                      <p className="text-xs text-muted-foreground mt-1 truncate" title={r.summary.nextAction}>{r.summary.nextAction}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 md:justify-end md:w-36 flex-shrink-0">
                    {canRemind ? (
                      <Button size="sm" variant="outline" onClick={() => setReminding(r)}>
                        <BellRing className="w-4 h-4" /> Remind
                      </Button>
                    ) : r.summary.stage === 'ready' || r.summary.stage === 'filed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-4 h-4" /> All documents in</span>
                    ) : null}
                    <ChevronRight className="w-4 h-4 text-muted-foreground hidden md:block" aria-hidden />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {reminding && (
        <ReminderDialog
          open
          onOpenChange={(o) => !o && setReminding(null)}
          clientName={reminding.name}
          fy={reminding.fy}
          items={reminding.summary.items}
          phone={reminding.summary.phone}
          firmName={firmName}
          onSent={(channel) => onRemind?.(reminding, channel)}
        />
      )}
    </div>
  );
}

const DOT: Record<string, string> = { ok: 'bg-success', received: 'bg-accent', issue: 'bg-destructive', missing: 'bg-transparent border border-warning' };
const DOT_TEXT: Record<string, string> = { ok: 'received and read', received: 'being read', issue: 'needs attention', missing: 'missing' };

/** One dot per required document: filled when in, hollow when missing. */
function DocDots({ items }: { items: ChecklistSummary['items'] }) {
  const done = items.filter((i) => !i.optional && i.status === 'ok').length;
  const total = items.filter((i) => !i.optional).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {items.filter((i) => !i.optional).map((i) => (
          <span key={i.id} title={`${i.label}: ${i.note ?? DOT_TEXT[i.status]}`} className={cn('w-2.5 h-2.5 rounded-full', DOT[i.status])} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground number-tabular">{done}/{total} documents</span>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'good' | 'warn' | 'accent' }) {
  const toneCls = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'accent' ? 'text-accent' : '';
  return (
    <div className="stat-card">
      <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
      <p className={cn('font-display text-2xl sm:text-[1.75rem] leading-tight font-semibold mt-1 number-tabular', toneCls)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
    </div>
  );
}

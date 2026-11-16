import { useMemo, useState } from 'react';
import { Check, X, Pencil, Plus, CheckCheck } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { ConfidenceBar, GroundingBadge, OriginBadge, PageHeader } from '@/components/common';
import { inr } from '@/lib/formatters';
import { CONFIDENCE_REVIEW_THRESHOLD } from '@/domain/caseFile';
import { FACT_FIELDS, FactField, FIELDS } from '@/domain/fields';
import type { Fact } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const GROUPS: { prefix: string; title: string }[] = [
  { prefix: 'salary', title: 'Salary' },
  { prefix: 'houseProperty', title: 'House property' },
  { prefix: 'otherSources', title: 'Other sources' },
  { prefix: 'capitalGains', title: 'Capital gains' },
  { prefix: 'business', title: 'Business' },
  { prefix: 'deductions', title: 'Deductions (Chapter VI-A)' },
  { prefix: 'taxesPaid', title: 'Taxes paid' },
  { prefix: 'recon', title: 'Reconciliation data (AIS, cash, PAN)' },
];

const fmt = (f: Fact) => (typeof f.value === 'number' ? inr(f.value) : typeof f.value === 'boolean' ? (f.value ? 'Yes' : 'No') : f.value);

function FactRow({ fact }: { fact: Fact }) {
  const { caseFile, dispatch } = useCase();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(fact.value));
  const doc = caseFile.documents.find((d) => d.id === fact.docId);
  const meta = FIELDS[fact.field];

  const save = () => {
    const value = meta.kind === 'amount' ? Number(draft.replace(/[,₹\s]/g, '')) : meta.kind === 'boolean' ? /^(y|yes|true|1)$/i.test(draft) : draft;
    if (meta.kind === 'amount' && !Number.isFinite(value as number)) return;
    dispatch({ type: 'editFact', id: fact.id, value });
    setEditing(false);
  };

  return (
    <tr className={cn('border-b border-border/60 align-top', fact.status === 'rejected' && 'opacity-50')}>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <OriginBadge origin={fact.origin} />
          <span className="font-medium text-sm">{fact.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{meta.label}</p>
      </td>
      <td className="py-3 pr-3 whitespace-nowrap">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 w-32" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save}><Check className="w-4 h-4" /></Button>
          </div>
        ) : (
          <div>
            <span className={cn('text-sm font-semibold number-tabular', fact.status === 'rejected' && 'line-through')}>{fmt(fact)}</span>
            {fact.originalValue !== undefined && <p className="text-xs text-muted-foreground">was {typeof fact.originalValue === 'number' ? inr(fact.originalValue) : String(fact.originalValue)}</p>}
          </div>
        )}
      </td>
      <td className="py-3 pr-3 max-w-[340px]">
        <p className="text-xs font-medium truncate">{doc?.name ?? 'Entered by reviewer'}</p>
        {fact.quote && <p className="text-xs text-muted-foreground mt-1 font-mono line-clamp-2" title={fact.quote}>“{fact.quote}”</p>}
        <div className="mt-1"><GroundingBadge grounded={fact.grounded} /></div>
      </td>
      <td className="py-3 pr-3"><ConfidenceBar value={fact.confidence} /></td>
      <td className="py-3 text-right whitespace-nowrap">
        {fact.status === 'proposed' ? (
          <div className="inline-flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-success" title="Accept" onClick={() => dispatch({ type: 'setFactStatus', ids: [fact.id], status: 'accepted' })}><Check className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => { setDraft(String(fact.value)); setEditing(true); }}><Pencil className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Reject" onClick={() => dispatch({ type: 'setFactStatus', ids: [fact.id], status: 'rejected' })}><X className="w-4 h-4" /></Button>
          </div>
        ) : (
          <button className="text-xs text-muted-foreground hover:underline" onClick={() => dispatch({ type: 'setFactStatus', ids: [fact.id], status: 'proposed' })}>
            {fact.status} · undo
          </button>
        )}
      </td>
    </tr>
  );
}

function AddFact() {
  const { addManualFact } = useCase();
  const [field, setField] = useState<FactField>('otherSources.depositInterest');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const meta = FIELDS[field];
  const submit = () => {
    const v = meta.kind === 'amount' ? Number(value.replace(/[,₹\s]/g, '')) : meta.kind === 'boolean' ? /^(y|yes|true|1)$/i.test(value) : value;
    if (meta.kind === 'amount' && (!Number.isFinite(v as number) || value === '')) return;
    addManualFact(field, v, note);
    setValue('');
    setNote('');
  };
  return (
    <div className="stat-card">
      <h3 className="font-semibold text-sm mb-1">Add a fact manually</h3>
      <p className="text-xs text-muted-foreground mb-3">For figures the client confirms by email or phone. Recorded as CA-entered in the audit trail.</p>
      <div className="flex flex-col md:flex-row gap-2">
        <Select value={field} onValueChange={(v) => setField(v as FactField)}>
          <SelectTrigger className="md:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FACT_FIELDS.map((f) => <SelectItem key={f} value={f}>{FIELDS[f].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder={meta.kind === 'amount' ? 'Amount (₹)' : meta.kind === 'boolean' ? 'yes / no' : 'Value'} value={value} onChange={(e) => setValue(e.target.value)} className="md:w-40" />
        <Input placeholder="Source / note (e.g. SBI FD certificate, emailed 12 Jun)" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
        <Button onClick={submit}><Plus className="w-4 h-4" /> Add</Button>
      </div>
    </div>
  );
}

export function ReviewView() {
  const { caseFile, dispatch, summary } = useCase();
  const [filter, setFilter] = useState<'all' | 'pending' | 'attention'>('all');

  const safeIds = useMemo(
    () => caseFile.facts.filter((f) => f.status === 'proposed' && f.grounded === true && f.confidence >= 0.9).map((f) => f.id),
    [caseFile.facts],
  );

  const visible = caseFile.facts.filter((f) =>
    filter === 'all' ? true : filter === 'pending' ? f.status === 'proposed' : f.status === 'proposed' && (f.grounded !== true || f.confidence < CONFIDENCE_REVIEW_THRESHOLD),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Review facts"
        subtitle="Every number the engine uses is listed here with its source line. Accept, correct or reject. Rejected facts are excluded from the computation; edits are kept in the audit trail."
        actions={
          <Button size="sm" disabled={safeIds.length === 0} onClick={() => dispatch({ type: 'setFactStatus', ids: safeIds, status: 'accepted' })}>
            <CheckCheck className="w-4 h-4" /> Accept {safeIds.length} verified (≥90%)
          </Button>
        }
      />

      <div className="flex gap-2 text-sm">
        {([['all', `All (${caseFile.facts.length})`], ['pending', `Pending (${summary.pendingReview})`], ['attention', 'Needs attention']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn('rounded-full px-3 py-1', filter === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{label}</button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const facts = visible.filter((f) => f.field.startsWith(g.prefix + '.'));
        if (!facts.length) return null;
        return (
          <div key={g.prefix} className="stat-card overflow-x-auto">
            <h3 className="font-semibold mb-2">{g.title}</h3>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 font-medium">Item</th><th className="py-2 font-medium">Value</th><th className="py-2 font-medium">Evidence</th><th className="py-2 font-medium">Confidence</th><th />
                </tr>
              </thead>
              <tbody>{facts.map((f) => <FactRow key={f.id} fact={f} />)}</tbody>
            </table>
          </div>
        );
      })}

      {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing to show for this filter.</p>}
      <AddFact />
    </div>
  );
}

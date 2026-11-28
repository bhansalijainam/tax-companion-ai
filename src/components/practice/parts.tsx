import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { STAGE_LABEL, reminderMessage, whatsappLink, type ChecklistSummary, type Stage } from '@/domain/checklist';
import type { ClientProfile } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STAGE_STYLE: Record<Stage, string> = {
  'not-started': 'bg-muted text-muted-foreground',
  'awaiting-docs': 'bg-warning/10 text-warning',
  'needs-review': 'bg-accent/10 text-accent',
  ready: 'bg-success/10 text-success',
  filed: 'bg-primary/10 text-primary',
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', STAGE_STYLE[stage])}>{STAGE_LABEL[stage]}</span>;
}

export function ReadyBar({ pct, stage }: { pct: number; stage: Stage }) {
  const tone = stage === 'ready' || stage === 'filed' ? 'bg-success' : stage === 'needs-review' ? 'bg-accent' : 'bg-warning';
  return (
    <div className="flex items-center gap-2 min-w-[96px]" aria-label={`${pct}% ready`}>
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs number-tabular text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

const PROFILE_FIELDS: { key: Exclude<keyof ClientProfile, 'employers'>; label: string; hint: string }[] = [
  { key: 'salaried', label: 'Salary income', hint: 'Form 16 from each employer' },
  { key: 'business', label: 'Business or profession', hint: 'P&L and balance sheet' },
  { key: 'capitalGains', label: 'Sold shares or mutual funds', hint: 'Broker capital-gains statement' },
  { key: 'rentalIncome', label: 'Rents out a property', hint: 'Rent agreement, property tax' },
  { key: 'paysRent', label: 'Pays rent (claims HRA)', hint: 'Rent receipts, landlord PAN' },
  { key: 'homeLoan', label: 'Home loan', hint: 'Interest certificate' },
  { key: 'educationLoan', label: 'Education loan', hint: 'Interest certificate (80E)' },
  { key: 'investments80C', label: '80C investments', hint: 'LIC, PPF, ELSS proofs' },
  { key: 'healthInsurance', label: 'Health insurance', hint: 'Premium receipts (80D)' },
];

/** Checkboxes describing the client's year. Every change re-derives the checklist. */
export function ProfileFields({ value, onChange, disabled }: { value: ClientProfile; onChange: (p: ClientProfile) => void; disabled?: boolean }) {
  const set = (patch: Partial<ClientProfile>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      {PROFILE_FIELDS.map((f) => (
        <div key={f.key} className="flex items-start gap-2.5">
          <Checkbox
            id={`pf-${f.key}`}
            checked={value[f.key]}
            disabled={disabled}
            onCheckedChange={(v) => set(f.key === 'salaried' ? { salaried: v === true, employers: v === true ? Math.max(1, value.employers) : 0 } : { [f.key]: v === true })}
            className="mt-0.5"
          />
          <Label htmlFor={`pf-${f.key}`} className="font-normal leading-snug cursor-pointer">
            {f.label}
            <span className="block text-xs text-muted-foreground">{f.hint}</span>
          </Label>
        </div>
      ))}
      {value.salaried && (
        <div className="flex items-center gap-2 sm:col-span-2">
          <Label htmlFor="pf-employers" className="font-normal">Employers this year</Label>
          <Input
            id="pf-employers" type="number" min={1} max={10} disabled={disabled} className="w-20 h-8"
            value={value.employers}
            onChange={(e) => set({ employers: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Reminder composer. Sends from the CA's own WhatsApp via a wa.me link (no API needed yet);
 * automated sending with templates and opt-in comes in M4.
 */
export function ReminderDialog({
  open, onOpenChange, clientName, fy, items, phone, firmName, onSent,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; clientName: string; fy: string;
  items: ChecklistSummary['items']; phone?: string; firmName?: string; onSent?: (channel: 'whatsapp' | 'copy') => void;
}) {
  const initial = useMemo(() => reminderMessage({ clientName, fy, items, firmName }), [clientName, fy, items, firmName]);
  const [text, setText] = useState(initial);
  const [to, setTo] = useState(phone ?? '');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) { setText(initial); setTo(phone ?? ''); setCopied(false); } }, [open, initial, phone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Remind {clientName.split(' ')[0]}</DialogTitle>
          <DialogDescription>Lists only what’s still missing. Edit it if you like, then send it from your own WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} aria-label="Reminder message" className="text-sm" />
          <div className="space-y-1.5">
            <Label htmlFor="rm-phone">Client’s WhatsApp number <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="rm-phone" inputMode="tel" placeholder="98765 43210" value={to} onChange={(e) => setTo(e.target.value)} />
            <p className="text-xs text-muted-foreground">Leave it blank to pick the contact inside WhatsApp.</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(text).then(
                () => { setCopied(true); onSent?.('copy'); toast.success('Message copied'); },
                () => toast.error('Copy failed; select the text instead'),
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
            </Button>
            <Button asChild onClick={() => onSent?.('whatsapp')}>
              <a href={whatsappLink(to, text)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4" /> Open in WhatsApp</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

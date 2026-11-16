import { useState } from 'react';
import { CheckCircle2, Copy, RotateCcw, XCircle, Bot, Scale, Gauge, ShieldAlert, GitCompare } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { PageHeader, PriorityBadge } from '@/components/common';
import { inr } from '@/lib/formatters';
import type { FlagView } from '@/domain/caseFile';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SOURCE: Record<FlagView['source'], { label: string; icon: typeof Bot }> = {
  rule: { label: 'Reconciliation rule', icon: Scale },
  model: { label: 'Raised by AI', icon: Bot },
  confidence: { label: 'Low confidence', icon: Gauge },
  grounding: { label: 'Citation check', icon: ShieldAlert },
  conflict: { label: 'Document conflict', icon: GitCompare },
};

function FlagCard({ flag }: { flag: FlagView }) {
  const { dispatch } = useCase();
  const [note, setNote] = useState(flag.note ?? '');
  const S = SOURCE[flag.source];
  const open = flag.state === 'open';
  return (
    <div className={cn('stat-card', !open && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <S.icon className="w-3.5 h-3.5" /> {S.label}
            {flag.amount !== undefined && <span>· {inr(Math.abs(flag.amount))} at stake</span>}
          </div>
          <h3 className="font-semibold">{flag.title}</h3>
          <p className="text-sm text-muted-foreground">{flag.detail}</p>
        </div>
        <PriorityBadge priority={flag.priority} />
      </div>
      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
        <span className="text-xs font-medium text-muted-foreground">Question for {flag.question.startsWith('Reviewer') ? 'reviewer' : 'client'}: </span>
        {flag.question.replace(/^Reviewer:\s*/, '')}
      </div>
      {open ? (
        <div className="mt-3 flex flex-col md:flex-row gap-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (e.g. client confirmed coaching was for self, not claimed)" className="min-h-[40px] flex-1" rows={1} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => dispatch({ type: 'setFlagState', id: flag.id, status: 'resolved', note })}><CheckCircle2 className="w-4 h-4" /> Resolve</Button>
            <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'setFlagState', id: flag.id, status: 'dismissed', note })}><XCircle className="w-4 h-4" /> Dismiss</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{flag.state}{flag.note ? ` — ${flag.note}` : ''}</span>
          <button className="inline-flex items-center gap-1 hover:underline" onClick={() => dispatch({ type: 'setFlagState', id: flag.id, status: 'open' })}><RotateCcw className="w-3 h-3" /> Reopen</button>
        </div>
      )}
    </div>
  );
}

export function FlagsView() {
  const { summary, caseFile } = useCase();
  const [emailOpen, setEmailOpen] = useState(false);
  const clientQs = summary.openFlags.filter((f) => !f.question.startsWith('Reviewer') && !f.question.startsWith('No action'));

  const email = `Subject: Documents needed for your FY ${caseFile.client.fy} income-tax return

Dear ${caseFile.client.name.split(' ')[0]},

Thank you for sharing your documents. To complete your return we need a few more details:

${clientQs.map((f, i) => `${i + 1}. ${f.question}`).join('\n')}

Please reply to this email with the documents or details at your earliest convenience.

Regards`;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Flags"
        subtitle="Deterministic reconciliation rules (AIS vs documents, thresholds, caps), questions the AI raised while reading documents, and facts whose citation or confidence needs a human. Rule flags clear themselves when the data is fixed."
        actions={<Button size="sm" variant="outline" disabled={!clientQs.length} onClick={() => setEmailOpen(true)}>Draft client email ({clientQs.length})</Button>}
      />

      {summary.flags.length === 0 && <p className="text-sm text-muted-foreground">No flags.</p>}
      <div className="space-y-4">
        {summary.flags.map((f) => <FlagCard key={f.id} flag={f} />)}
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Client follow-up email</DialogTitle></DialogHeader>
          <pre className="text-sm whitespace-pre-wrap bg-muted/50 rounded-lg p-4 max-h-[60vh] overflow-auto">{email}</pre>
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(email).then(() => toast.success('Copied to clipboard'), () => toast.error('Clipboard unavailable'));
            }}
          >
            <Copy className="w-4 h-4" /> Copy
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

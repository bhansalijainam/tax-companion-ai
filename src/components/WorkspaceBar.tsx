import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CloudOff, Loader2, Lock, LockOpen } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_LABEL = { draft: 'Draft', in_review: 'In review', final: 'Final' } as const;

/** Header controls for a server-saved case: back to clients, save state, case status. */
export function WorkspaceBar() {
  const { saveState, caseStatus, role, changeStatus } = useCase();
  const save =
    saveState === 'saving' ? { icon: Loader2, text: 'Saving…', cls: 'text-muted-foreground', spin: true }
    : saveState === 'saved' ? { icon: Check, text: 'Saved', cls: 'text-success' }
    : saveState === 'conflict' ? { icon: AlertTriangle, text: 'Not saved', cls: 'text-destructive' }
    : saveState === 'locked' ? { icon: Lock, text: 'Final, read-only', cls: 'text-muted-foreground' }
    : saveState === 'error' ? { icon: CloudOff, text: 'Offline, not saved', cls: 'text-destructive' }
    : null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/app"><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Clients</span></Link>
      </Button>
      {caseStatus && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', caseStatus === 'final' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
          {STATUS_LABEL[caseStatus]}
        </span>
      )}
      {save && (
        <span className={cn('hidden sm:inline-flex items-center gap-1 text-xs', save.cls)} role="status">
          <save.icon className={cn('w-3.5 h-3.5', save.spin && 'animate-spin')} /> {save.text}
        </span>
      )}
      {role === 'partner' && caseStatus && caseStatus !== 'final' && (
        <Button size="sm" variant="outline" onClick={() => void changeStatus('final')} title="Lock the case after sign-off">
          <Lock className="w-4 h-4" /><span className="hidden sm:inline">Mark final</span>
        </Button>
      )}
      {role === 'partner' && caseStatus === 'final' && (
        <Button size="sm" variant="outline" onClick={() => void changeStatus('in_review')}>
          <LockOpen className="w-4 h-4" /><span className="hidden sm:inline">Reopen</span>
        </Button>
      )}
    </div>
  );
}

/** Explains a save that could not be written, with the one action that fixes it. */
export function SaveBanner() {
  const { saveState, saveMessage, caseStatus } = useCase();
  if (caseStatus === 'final' || saveState === 'locked') {
    return (
      <div className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm mb-4 flex gap-2" role="status">
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        This case is final and read-only. Changes you make here won’t be saved. A partner can reopen it.
      </div>
    );
  }
  if (saveState === 'conflict') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm mb-4 flex flex-wrap items-center gap-3" role="alert">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <span className="flex-1">{saveMessage ?? 'Someone else changed this case.'} Your latest edit was not saved.</span>
        <Button size="sm" onClick={() => location.reload()}>Reload latest</Button>
      </div>
    );
  }
  if (saveState === 'error') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm mb-4" role="alert">
        {saveMessage ?? 'Could not save.'} We’ll try again with your next change.
      </div>
    );
  }
  return null;
}

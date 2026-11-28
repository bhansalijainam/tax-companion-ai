import { useState } from 'react';
import { AlertCircle, ArrowRight, BellRing, CheckCircle2, Circle, Inbox, Upload, Wand2 } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { demoPractice } from '@/state/practiceStore';
import { genericPersona, nextSampleDoc } from '@/fixtures/samplePractice';
import type { ChecklistItem } from '@/domain/checklist';
import type { Section } from '@/components/nav';
import { PageHeader } from '@/components/common';
import { ProfileFields, ReadyBar, ReminderDialog, StageBadge } from '@/components/practice/parts';
import { UploadLinkCard } from '@/components/practice/UploadLinkCard';
import type { UploadLinkInfo } from '@/state/caseStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const ICON = {
  ok: { icon: CheckCircle2, cls: 'text-success', text: 'Received' },
  received: { icon: Inbox, cls: 'text-accent', text: 'Received' },
  issue: { icon: AlertCircle, cls: 'text-destructive', text: 'Needs attention' },
  missing: { icon: Circle, cls: 'text-warning', text: 'Missing' },
} as const;

/** Which documents this client owes, given their year, and how far each one has got. */
export function ChecklistView({ go }: { go: (s: Section) => void }) {
  const { caseFile, checklist, setProfile, setContact, store, caseStatus, addSampleDocument, logEvent } = useCase();
  const [reminding, setReminding] = useState(false);
  const [phone, setPhone] = useState(caseFile.client.phone ?? '');
  const [uploadLink, setUploadLink] = useState<UploadLinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const locked = caseStatus === 'final';
  const demoId = 'demoClientId' in store ? (store as { demoClientId: string }).demoClientId : null;
  const mandatory = checklist.items.filter((i) => !i.optional);
  const done = mandatory.filter((i) => i.status === 'ok').length;
  const canRemind = checklist.items.some((i) => (i.status === 'missing' && !i.optional) || (i.status === 'issue' && i.note?.startsWith('Could not')));

  /** Reminders carry an upload link; make one if this visit hasn't yet */
  const openReminder = async () => {
    setLinkError(null);
    if (store.uploadLinks && !uploadLink) {
      try {
        setUploadLink(await store.uploadLinks.create());
      } catch (e) {
        // The reminder still works without a link; say so instead of failing silently
        setLinkError(`Couldn’t create an upload link (${(e as Error).message}). The message below asks the client to reply with files instead.`);
      }
    }
    setReminding(true);
  };

  const simulate = (item: ChecklistItem) => {
    const persona = (demoId && demoPractice.persona(demoId)) || genericPersona(caseFile);
    addSampleDocument(nextSampleDoc(persona, caseFile, item.kind));
  };

  const nextTarget: Section | null =
    checklist.pendingFacts ? 'review' : checklist.openHighFlags ? 'flags' : checklist.stage === 'ready' ? 'report' : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Document checklist"
        subtitle={`What ${caseFile.client.name.split(' ')[0] || 'this client'} needs to send for FY ${caseFile.client.fy}, worked out from their year. Change the profile and the list updates.`}
        actions={canRemind && !locked ? <Button onClick={openReminder}><BellRing className="w-4 h-4" /> Send reminder</Button> : undefined}
      />

      <div className="stat-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2"><StageBadge stage={checklist.stage} /><span className="text-sm text-muted-foreground number-tabular">{done} of {mandatory.length} documents received</span></div>
          <p className="text-sm font-medium">{checklist.nextAction}</p>
        </div>
        <div className="flex items-center gap-3 sm:w-72">
          <div className="flex-1"><ReadyBar pct={checklist.readyPct} stage={checklist.stage} /></div>
          {nextTarget && <Button size="sm" variant="outline" onClick={() => go(nextTarget)}>Open <ArrowRight className="w-4 h-4" /></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 stat-card p-0" aria-labelledby="req-h">
          <h2 id="req-h" className="px-5 pt-4 pb-2 font-semibold">Required documents</h2>
          <ul className="divide-y divide-border">
            {checklist.items.map((item) => {
              const s = ICON[item.status];
              return (
                <li key={item.id} className="px-5 py-3.5 flex gap-3">
                  <s.icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', s.cls)} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {item.label}
                      {item.optional && <span className="ml-2 text-xs font-normal text-muted-foreground">optional</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.why}</p>
                    <p className={cn('text-xs mt-1', item.status === 'missing' ? 'text-warning' : item.status === 'issue' ? 'text-destructive' : 'text-muted-foreground')}>
                      <span className="sr-only">Status: </span>{s.text}{item.note ? ` · ${item.note}` : item.count ? ` · ${item.count} file${item.count > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  {item.status === 'missing' && !locked && (
                    <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                      {demoId !== null || store.kind === 'local' ? (
                        <Button size="sm" variant="outline" onClick={() => simulate(item)} title="Demo: the client sends this document">
                          <Wand2 className="w-4 h-4" /> <span className="hidden sm:inline">Client sends it</span><span className="sm:hidden">Send</span>
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => go('documents')}><Upload className="w-4 h-4" /> Upload</Button>
                    </div>
                  )}
                  {item.status === 'issue' && <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => go(item.note?.startsWith('Could not') ? 'documents' : 'flags')}>View</Button>}
                </li>
              );
            })}
          </ul>
          {(demoId !== null || store.kind === 'local') && (
            <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
              Demo: “Client sends it” plays the client’s side in one click. To see the client’s own page, create an upload link on the right and open it.
            </p>
          )}
        </section>

        <div className="lg:col-span-2 space-y-6">
          <section className="stat-card space-y-4" aria-labelledby="prof-h">
            <div>
              <h2 id="prof-h" className="font-semibold">This year, the client has…</h2>
              {checklist.profileInferred && (
                <p className="text-xs text-warning mt-1">Guessed from the documents on file. Confirm it so the checklist is right.</p>
              )}
            </div>
            <ProfileFields value={checklist.profile} onChange={setProfile} disabled={locked} />
          </section>

          {store.uploadLinks && <UploadLinkCard api={store.uploadLinks} disabled={locked} onLink={setUploadLink} current={uploadLink} />}

          <section className="stat-card space-y-3" aria-labelledby="contact-h">
            <h2 id="contact-h" className="font-semibold">Contact for reminders</h2>
            <div className="space-y-1.5">
              <Label htmlFor="cl-phone">WhatsApp number</Label>
              <div className="flex gap-2">
                <Input id="cl-phone" inputMode="tel" placeholder="98765 43210" value={phone} disabled={locked} onChange={(e) => setPhone(e.target.value)} onBlur={() => setContact(phone.trim(), caseFile.client.email)} />
              </div>
              <p className="text-xs text-muted-foreground">Reminders open in your own WhatsApp for now. Automatic reminders with client opt-in come later.</p>
            </div>
          </section>
        </div>
      </div>

      <ReminderDialog
        notice={linkError}
        open={reminding}
        onOpenChange={setReminding}
        clientName={caseFile.client.name}
        fy={caseFile.client.fy}
        items={checklist.items}
        phone={caseFile.client.phone}
        uploadUrl={uploadLink?.url}
        onSent={(channel) => logEvent(channel === 'whatsapp' ? 'reminder.whatsapp' : 'reminder.copied', `Missing: ${checklist.items.filter((i) => i.status === 'missing' && !i.optional).map((i) => i.label).join('; ') || 'none'}`)}
      />
    </div>
  );
}

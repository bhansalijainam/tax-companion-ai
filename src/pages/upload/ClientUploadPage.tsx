import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, FileUp, Landmark, Loader2, Lock, Sparkles, Upload } from 'lucide-react';
import { ACCEPT_ATTR, MAX_FILE_BYTES, normaliseMime, type UploadRequestView } from '@/domain/upload';
import type { UploadBackend } from './uploadBackend';
import type { DocKind } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

/**
 * What the client sees: who is asking, what is still needed and why, one button per item.
 * No login, no PAN, no amounts: the link only adds files to one case.
 */
export function ClientUploadPage({ backend, demo = false }: { backend: UploadBackend; demo?: boolean }) {
  const [view, setView] = useState<UploadRequestView | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [justSent, setJustSent] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<DocKind | undefined>(undefined);

  useEffect(() => {
    backend.load().then(setView, (e: Error) => setFatal(e.message));
  }, [backend]);

  const send = useCallback(async (files: FileList | null, kind?: DocKind, label?: string) => {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) { setError(`${file.name} is larger than 4 MB. Send a smaller copy, or a photo of each page.`); continue; }
      if (!normaliseMime(file.type, file.name)) { setError(`${file.name}: please send a PDF, a photo (JPEG, PNG, WebP) or a text/CSV file.`); continue; }
      setBusy(kind ?? 'other');
      try {
        setView(await backend.upload(file, kind));
        setJustSent(label ?? file.name);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 410 || status === 409) setFatal((e as Error).message);
        else setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    }
  }, [backend]);

  const pick = (kind?: DocKind) => { target.current = kind; input.current?.click(); };

  if (fatal) {
    return (
      <Shell firm={view?.firmName}>
        <div className="stat-card text-center space-y-2 py-10">
          <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
          <p className="font-medium">This link can’t take files right now</p>
          <p className="text-sm text-muted-foreground">{fatal}</p>
        </div>
      </Shell>
    );
  }
  if (!view) return <Shell><p className="text-sm text-muted-foreground py-10 text-center">Loading…</p></Shell>;

  const needed = view.items.filter((i) => i.status === 'missing' && !i.optional);
  const optional = view.items.filter((i) => i.status === 'missing' && i.optional);
  const done = view.items.filter((i) => i.status !== 'missing');

  return (
    <Shell firm={view.firmName}>
      {demo && (
        <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Demo of the client’s page. On a phone this is what your client opens from WhatsApp. Files stay in this browser.
        </p>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Hi {view.clientFirstName},</h1>
        <p className="text-muted-foreground">
          {needed.length
            ? <>{view.firmName} needs {needed.length === 1 ? 'one more document' : `${needed.length} more documents`} to file your income-tax return for FY {view.fy}.</>
            : <>Thank you. {view.firmName} has everything it asked for. You can still send anything else below.</>}
        </p>
      </div>

      {justSent && (
        <p className="rounded-lg bg-success/10 text-success px-3 py-2 text-sm flex items-center gap-2" role="status">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Received: {justSent}
        </p>
      )}
      {error && <p className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm" role="alert">{error}</p>}

      <input
        ref={input} type="file" multiple accept={ACCEPT_ATTR} className="sr-only" aria-hidden tabIndex={-1}
        onChange={(e) => { const k = target.current; const label = view.items.find((i) => i.kind === k)?.label; void send(e.target.files, k, label); e.target.value = ''; }}
      />

      {view.closed ? (
        <div className="stat-card text-sm text-muted-foreground flex gap-2"><Lock className="w-4 h-4 mt-0.5" /> Your return has been filed. Contact {view.firmName} if anything changed.</div>
      ) : (
        <>
          {[...needed, ...optional].length > 0 && (
            <ul className="space-y-3">
              {[...needed, ...optional].map((i) => (
                <li key={i.id} className="stat-card p-4 space-y-3">
                  <div className="flex gap-3">
                    <Circle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{i.label}{i.optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">if you have it</span>}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{i.why}</p>
                      {i.note && <p className="text-xs text-warning mt-1">{i.note}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="w-full sm:w-auto h-11" onClick={() => pick(i.kind)} disabled={busy !== null}>
                      {busy === i.kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
                    </Button>
                    {demo && backend.sample && (
                      <Button variant="outline" className="w-full sm:w-auto h-11" disabled={busy !== null}
                        onClick={async () => { setBusy(i.kind); try { setView(await backend.sample!(i.kind)); setJustSent(i.label); } finally { setBusy(null); } }}>
                        <Sparkles className="w-4 h-4" /> Use sample document
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" className="w-full h-11" onClick={() => pick(undefined)} disabled={busy !== null}>
            {busy === 'other' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} Send another document
          </Button>
        </>
      )}

      {done.length > 0 && (
        <section className="space-y-2" aria-labelledby="done-h">
          <h2 id="done-h" className="text-sm font-medium text-muted-foreground">Already with {view.firmName}</h2>
          <ul className="space-y-1.5">
            {done.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" /> {i.label}</li>
            ))}
          </ul>
        </section>
      )}

      {view.uploaded.length > 0 && (
        <section className="space-y-2" aria-labelledby="sent-h">
          <h2 id="sent-h" className="text-sm font-medium text-muted-foreground">You sent</h2>
          <ul className="space-y-1 text-sm">
            {view.uploaded.map((u, k) => <li key={k} className="truncate">{u.name}</li>)}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        Files go only to {view.firmName}, into your own client file. This page can add files, but it can’t open or download anything in your file.
        Accepted: PDF, photos (JPEG, PNG, WebP), text or CSV, up to 4 MB each. Link works until {fmtDate(view.expiresAt)}.
      </p>
    </Shell>
  );
}

function Shell({ children, firm }: { children: React.ReactNode; firm?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-saffron flex items-center justify-center flex-shrink-0">
            <Landmark className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <span className={cn('font-semibold truncate', !firm && 'text-muted-foreground')}>{firm ?? 'Secure document upload'}</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6 space-y-5">{children}</main>
    </div>
  );
}

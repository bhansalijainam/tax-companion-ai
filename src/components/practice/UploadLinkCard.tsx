import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Link2Off, Loader2 } from 'lucide-react';
import type { UploadLinkApi, UploadLinkInfo, UploadLinkStatus } from '@/state/caseStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * A private link the client opens from WhatsApp to send documents, no login.
 * The link is shown once, when made; the server keeps only its hash.
 */
export function UploadLinkCard({ api, disabled, onLink, current }: { api: UploadLinkApi; disabled?: boolean; onLink?: (l: UploadLinkInfo | null) => void; current?: UploadLinkInfo | null }) {
  const [status, setStatus] = useState<UploadLinkStatus | null>(null);
  const [link, setLink] = useState<UploadLinkInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => api.status().then(setStatus, (e: Error) => setError(e.message)), [api]);
  useEffect(() => { void refresh(); }, [refresh]);
  // A link made elsewhere (e.g. by "Send reminder") is shown here too
  useEffect(() => { if (current) { setLink(current); void refresh(); } }, [current, refresh]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const l = await api.create();
      setLink(l); onLink?.(l); setCopied(false);
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setError(null);
    try {
      const n = await api.revokeAll();
      setLink(null); onLink?.(null);
      toast.success(n ? 'Upload links turned off' : 'No active links');
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="stat-card space-y-3" aria-labelledby="ul-h">
      <div>
        <h2 id="ul-h" className="font-semibold flex items-center gap-2"><Link2 className="w-4 h-4" /> Client upload link</h2>
        <p className="text-xs text-muted-foreground mt-1">
          A private link for this client only. They see what’s still needed and upload from their phone, no login. Files land in this case. Works for 14 days.
        </p>
      </div>

      {link ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={link.url} aria-label="Upload link" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(link.url).then(() => { setCopied(true); toast.success('Link copied'); }, () => toast.error('Copy failed; select the link instead'))}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" asChild aria-label="Open the client's page">
              <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Copy it now: for safety it isn’t shown again. “Send reminder” includes it automatically. Expires {fmt(link.expiresAt)}.</p>
        </div>
      ) : status && status.active > 0 ? (
        <p className="text-xs text-muted-foreground">{status.active} active link{status.active > 1 ? 's' : ''}{status.latestExpiresAt ? `, until ${fmt(status.latestExpiresAt)}` : ''}. Make a new one to copy it again.</p>
      ) : null}

      {status && status.files > 0 && <p className="text-xs text-muted-foreground">{status.files} file{status.files > 1 ? 's' : ''} received through links.</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={create} disabled={busy || disabled}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} {status?.active || link ? 'New link' : 'Create link'}
        </Button>
        {(status?.active ?? 0) > 0 && (
          <Button size="sm" variant="ghost" onClick={revoke} disabled={busy}><Link2Off className="w-4 h-4" /> Turn off links</Button>
        )}
      </div>
    </section>
  );
}

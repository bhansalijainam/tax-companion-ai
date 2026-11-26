import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Landmark, LogOut, Plus, Search, UserPlus } from 'lucide-react';
import { authClient, type Me } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ClientItem {
  id: string; name: string; pan: string | null; case_id: string | null; fy: string | null;
  status: 'draft' | 'in_review' | 'final' | null; updated_at: string | null; created_at: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-muted text-muted-foreground' },
  in_review: { label: 'In review', cls: 'bg-warning/10 text-warning' },
  final: { label: 'Final', cls: 'bg-success/10 text-success' },
};

/** PAN shown as ABCDE••••F: enough to tell clients apart, not enough to reuse */
const maskPan = (p: string | null) => (p ? `${p.slice(0, 5)}••••${p.slice(-1)}` : '—');

export function ClientsPage({ me }: { me: Me }) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientItem[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const org = authClient.useActiveOrganization();

  const load = useCallback(async (search: string) => {
    const res = await fetch(`/api/clients${search ? `?q=${encodeURIComponent(search)}` : ''}`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Could not load clients'); return; }
    setClients(body.clients);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q), 200);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-saffron flex items-center justify-center flex-shrink-0">
              <Landmark className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold truncate">{org.data?.name ?? 'Your firm'}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {me.role === 'partner' ? 'Partner' : 'Preparer'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">{me.email}</span>
            <Button variant="ghost" size="sm" onClick={() => authClient.signOut({}).then(() => location.assign('/app'))}>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">Every case is saved for your whole firm, with a full audit trail.</p>
          </div>
          <div className="flex gap-2">
            {me.role === 'partner' && <Button variant="outline" onClick={() => setInviting(true)}><UserPlus className="w-4 h-4" /> Invite</Button>}
            <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New client</Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search clients" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <div className="stat-card p-0 overflow-x-auto">
          {clients === null ? (
            <p className="p-5 text-sm text-muted-foreground">Loading clients…</p>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="font-medium">{q ? 'No clients match that search.' : 'No clients yet'}</p>
              {!q && <p className="text-sm text-muted-foreground">Add your first client to start a case. You can upload their documents on the next screen.</p>}
            </div>
          ) : (
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Client</th><th className="px-5 py-3 font-medium">PAN</th>
                  <th className="px-5 py-3 font-medium">FY</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">
                      {c.case_id ? <Link className="hover:underline" to={`/app/cases/${c.case_id}`}>{c.name}</Link> : c.name}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{maskPan(c.pan)}</td>
                    <td className="px-5 py-3">{c.fy ?? '—'}</td>
                    <td className="px-5 py-3">{c.status && <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS[c.status].cls)}>{STATUS[c.status].label}</span>}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(c.updated_at ?? c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <NewClientDialog open={creating} onOpenChange={setCreating} onCreated={(caseId) => navigate(`/app/cases/${caseId}`)} />
      {me.role === 'partner' && <InviteDialog open={inviting} onOpenChange={setInviting} />}
    </div>
  );
}

function NewClientDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (caseId: string) => void }) {
  const [name, setName] = useState('');
  const [pan, setPan] = useState('');
  const [fy, setFy] = useState('2024-25');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await fetch('/api/clients', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pan, fy }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(body.error ?? 'Could not create the client'); return; }
    onCreated(body.caseId);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="nc-name">Client name</Label><Input id="nc-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-pan">PAN <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="nc-pan" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-fy">Financial year</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger id="nc-fy"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2024-25">FY 2024-25 (AY 2025-26)</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">FY 2025-26 rules are the next milestone.</p>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create and open case'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = await authClient.organization.inviteMember({ email, role: 'member' });
    if (r.error) { setError(r.error.message ?? 'Could not create the invitation'); return; }
    setLink(`${location.origin}/app/invite/${r.data!.id}`);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setLink(null); setEmail(''); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Invite a preparer</DialogTitle></DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send this link to {email}. They’ll sign up with that email and join your firm as a preparer.</p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" aria-label="Invitation link" onFocus={(e) => e.target.select()} />
              <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copied'), () => toast.error('Copy failed; select the link instead'))}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="inv-email">Their work email</Label><Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full">Create invitation link</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Landmark, LogOut, Plus, UserPlus } from 'lucide-react';
import { authClient, type Me } from '@/lib/authClient';
import type { ChecklistSummary } from '@/domain/checklist';
import { PracticeDashboard, type DashboardRow } from '@/components/practice/PracticeDashboard';
import { NewClientDialog } from '@/components/practice/NewClientDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ClientItem {
  id: string; name: string; pan: string | null; case_id: string | null; fy: string | null;
  status: 'draft' | 'in_review' | 'final' | null; updated_at: string | null; created_at: string;
  summary: ChecklistSummary | null;
}

export function ClientsPage({ me }: { me: Me }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DashboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const org = authClient.useActiveOrganization();

  const load = useCallback(async () => {
    const res = await fetch('/api/clients', { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Could not load clients'); return; }
    setRows(
      (body.clients as ClientItem[])
        .filter((c) => c.case_id && c.summary)
        .map((c) => ({
          id: c.id, name: c.name, pan: c.pan, fy: c.fy ?? '', summary: c.summary!,
          updatedAt: c.updated_at ?? c.created_at, href: `/app/cases/${c.case_id}`,
        })),
    );
  }, []);

  useEffect(() => { void load(); }, [load]);

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
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground hidden md:inline mr-1">{me.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => authClient.signOut({}).then(() => location.assign('/app'))}>
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">Who still owes documents, who needs review, and who is ready to file. Every case has a full audit trail.</p>
          </div>
          <div className="flex gap-2">
            {me.role === 'partner' && <Button variant="outline" onClick={() => setInviting(true)}><UserPlus className="w-4 h-4" /> Invite</Button>}
            <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New client</Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <PracticeDashboard
          rows={error ? [] : rows}
          firmName={org.data?.name}
          emptyHint="Add your first client. Tick what their year looks like and the document checklist is built for you."
        />
      </main>

      <NewClientDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={async (input) => {
          const res = await fetch('/api/clients', {
            method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: input.name, pan: input.pan, phone: input.phone || undefined, profile: input.profile, fy: '2024-25' }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) return body.error ?? 'Could not create the client';
          navigate(`/app/cases/${body.caseId}#checklist`);
        }}
      />
      {me.role === 'partner' && <InviteDialog open={inviting} onOpenChange={setInviting} />}
    </div>
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

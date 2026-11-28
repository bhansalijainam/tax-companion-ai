import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { authClient } from '@/lib/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-saffron flex items-center justify-center">
            <Landmark className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold">Tax Companion</span>
        </div>
        <div>
          <h1 className="text-3xl font-display font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
        </div>
        <div className="stat-card space-y-4">{children}</div>
      </div>
    </div>
  );
}

const errText = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Something went wrong. Try again.');

export function SignInScreen({ note, onDone }: { note?: string; onDone?: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = mode === 'in'
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: name || email.split('@')[0] });
    setBusy(false);
    if (r.error) setError(errText(r.error));
    else onDone?.();
  };

  return (
    <Shell
      title={mode === 'in' ? 'Sign in to your firm' : 'Create your account'}
      subtitle={note ?? 'Your firm’s client cases, saved and shared with your team. Every figure stays linked to its source document.'}
    >
      <form onSubmit={submit} className="space-y-4">
        {mode === 'up' && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Your name</Label>
            <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Work email</Label>
          <Input id="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auth-password">Password</Label>
          <Input id="auth-password" type="password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          {mode === 'up' && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</Button>
      </form>
      <p className="text-sm text-muted-foreground text-center">
        {mode === 'in' ? 'New here? ' : 'Already have an account? '}
        <button className="text-accent underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      <p className="text-xs text-muted-foreground text-center"><a className="underline" href="/">Try the demo without an account</a></p>
    </Shell>
  );
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'firm';

export function FirmSetupScreen({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.organization.create({ name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}` });
    if (r.error) { setBusy(false); setError(errText(r.error)); return; }
    await authClient.organization.setActive({ organizationId: r.data!.id });
    setBusy(false);
    onDone();
  };

  return (
    <Shell title="Set up your firm" subtitle="You’ll be the partner for this firm. You can invite preparers from the client list. Joining an existing firm? Open the invite link your partner sent you.">
      <form onSubmit={create} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="firm-name">Firm name</Label>
          <Input id="firm-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mehta & Associates" />
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create firm'}</Button>
      </form>
      <button className="text-xs text-muted-foreground underline" onClick={() => authClient.signOut({}).then(() => location.assign('/app'))}>Sign out</button>
    </Shell>
  );
}

export function AcceptInviteScreen({ invitationId, onDone }: { invitationId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const r = await authClient.organization.acceptInvitation({ invitationId });
    setBusy(false);
    if (r.error) setError(errText(r.error));
    else onDone();
  };
  return (
    <Shell title="Join your firm" subtitle="You’ve been invited to work on this firm’s client cases as a preparer.">
      {error && <p className="text-sm text-destructive" role="alert">{error} Make sure you’re signed in with the email the invitation was sent to.</p>}
      <Button className="w-full" onClick={accept} disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</Button>
    </Shell>
  );
}

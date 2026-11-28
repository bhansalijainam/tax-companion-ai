import { useState } from 'react';
import { EMPTY_PROFILE, requirements } from '@/domain/checklist';
import type { ClientProfile } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileFields } from './parts';

export interface NewClientInput { name: string; pan: string; phone: string; profile: ClientProfile }

/** Name, PAN, phone and the year's profile. The checklist preview updates as boxes are ticked. */
export function NewClientDialog({
  open, onOpenChange, onSubmit, note,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  /** Resolve with an error message to show, or nothing on success */
  onSubmit: (input: NewClientInput) => Promise<string | void>;
  note?: string;
}) {
  const [name, setName] = useState('');
  const [pan, setPan] = useState('');
  const [phone, setPhone] = useState('');
  const [profile, setProfile] = useState<ClientProfile>({ ...EMPTY_PROFILE, salaried: true, employers: 1 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const docs = requirements(profile).filter((r) => !r.optional);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const err = await onSubmit({ name: name.trim(), pan: pan.trim(), phone: phone.trim(), profile });
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="nc-name">Client name</Label><Input id="nc-name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-pan">PAN <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="nc-pan" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">WhatsApp <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="nc-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">This year the client has…</legend>
            <ProfileFields value={profile} onChange={setProfile} />
          </fieldset>
          <p className="text-xs text-muted-foreground">
            We’ll ask for {docs.length} document{docs.length === 1 ? '' : 's'}: {docs.map((d) => d.label).join('; ')}.
          </p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create client'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

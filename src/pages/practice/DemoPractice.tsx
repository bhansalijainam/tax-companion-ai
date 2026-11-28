import { useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FlaskConical, Landmark, Plus, RotateCcw } from 'lucide-react';
import { CaseProvider } from '@/state/CaseContext';
import { DEMO_FIRM, DemoClientCaseStore, demoPractice } from '@/state/practiceStore';
import Index from '@/pages/Index';
import { PracticeDashboard, type DashboardRow } from '@/components/practice/PracticeDashboard';
import { NewClientDialog } from '@/components/practice/NewClientDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DemoUploadRoute } from '@/pages/upload/UploadRoutes';

const FIRM = `${DEMO_FIRM} (demo)`;

function DemoDashboard() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows: DashboardRow[] = useMemo(() => demoPractice.rows().map((r) => ({ ...r, href: `/practice/${r.id}` })), [version]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-saffron flex items-center justify-center flex-shrink-0">
              <Landmark className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold truncate">{FIRM}</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => { demoPractice.reset(); setVersion((v) => v + 1); }} title="Restore the ten sample clients">
              <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Reset demo</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clients · FY 2024-25</h1>
            <p className="text-sm text-muted-foreground mt-1">Who still owes documents, who needs your review, and who is ready to file.</p>
          </div>
          <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New client</Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex gap-2">
          <FlaskConical className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            <strong className="text-foreground">Demo practice.</strong> Ten fictional clients, kept only in this browser, each stored separately.
            Open a client to see their checklist, and press “Client sends it” to play the client’s side.{' '}
            <Link to="/app" className="underline">Sign in</Link> to use it with real clients.
          </p>
        </div>

        <PracticeDashboard
          rows={rows}
          firmName={FIRM.replace(' (demo)', '')}
          onRemind={(row, channel) => {
            const c = demoPractice.getCase(row.id);
            if (!c) return;
            const missing = row.summary.items.filter((i) => i.status === 'missing' && !i.optional).map((i) => i.label).join('; ');
            demoPractice.saveCase(row.id, { ...c, audit: [...c.audit, { at: new Date().toISOString(), actor: 'ca', action: channel === 'whatsapp' ? 'reminder.whatsapp' : 'reminder.copied', detail: `Missing: ${missing}` }] });
            setVersion((v) => v + 1);
          }}
        />

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          Single-case walkthrough with the AI assistant and evals: <Link to="/" className="underline inline-flex items-center gap-0.5">open it <ArrowRight className="w-3 h-3" /></Link>
        </p>
      </main>

      <NewClientDialog
        open={creating}
        onOpenChange={setCreating}
        note="Demo: the client is saved in this browser only."
        onSubmit={async (input) => {
          if (input.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.pan)) return 'PAN must look like ABCDE1234F';
          const id = demoPractice.createClient(input);
          setCreating(false);
          navigate(`/practice/${id}#checklist`);
        }}
      />
    </div>
  );
}

function DemoClient() {
  const { id = '' } = useParams();
  const store = useMemo(() => new DemoClientCaseStore(id), [id]);
  // Keyed by case: a fresh provider (and read tracking) for each case
  return (
    <CaseProvider key={id} store={store}>
      <Index practiceDemo />
    </CaseProvider>
  );
}

/** /practice: the public demo of the multi-client dashboard. No sign-in, no server. */
export default function DemoPractice() {
  return (
    <Routes>
      <Route index element={<DemoDashboard />} />
      <Route path=":id" element={<DemoClient />} />
      <Route path=":id/upload" element={<DemoUploadRoute />} />
    </Routes>
  );
}

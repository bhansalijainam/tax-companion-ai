import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { authClient, fetchMe, type Me } from '@/lib/authClient';
import { CaseProvider } from '@/state/CaseContext';
import { ApiCaseStore } from '@/state/caseStore';
import Index from '@/pages/Index';
import { AcceptInviteScreen, FirmSetupScreen, SignInScreen } from './AuthScreens';
import { ClientsPage } from './ClientsPage';

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground">{children}</div>;
}

function CaseRoute() {
  const { id = '' } = useParams();
  const store = useMemo(() => new ApiCaseStore(id), [id]);
  // Keyed by case: a fresh provider (and read tracking) for each case
  return (
    <CaseProvider key={id} store={store}>
      <Index workspace />
    </CaseProvider>
  );
}

function InviteRoute({ signedIn, onJoined }: { signedIn: boolean; onJoined: () => void }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  if (!signedIn) return <SignInScreen note="Sign in or create an account with the email your partner invited, then accept the invitation." />;
  return <AcceptInviteScreen invitationId={id} onDone={() => { onJoined(); navigate('/app'); }} />;
}

/** /app: the signed-in practice workspace. The public demo at / is unaffected. */
export default function WorkspaceApp() {
  const session = authClient.useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [meStatus, setMeStatus] = useState<number | null>(null);

  const refreshMe = useCallback(async () => {
    const r = await fetchMe();
    setMe(r.member);
    setMeStatus(r.status);
  }, []);

  useEffect(() => {
    if (session.data) void refreshMe();
  }, [session.data, refreshMe]);

  if (session.isPending) return <Centered>Loading…</Centered>;
  const signedIn = Boolean(session.data);

  return (
    <Routes>
      <Route path="invite/:id" element={<InviteRoute signedIn={signedIn} onJoined={refreshMe} />} />
      <Route
        path="*"
        element={
          !signedIn ? <SignInScreen onDone={() => session.refetch()} />
          : meStatus === null ? <Centered>Loading your firm…</Centered>
          : meStatus === 503 || meStatus === 500 ? <Centered>The workspace isn’t available right now. Try again shortly, or use the demo at /.</Centered>
          : !me ? <FirmSetupScreen onDone={refreshMe} />
          : (
            <Routes>
              <Route index element={<ClientsPage me={me} />} />
              <Route path="cases/:id" element={<CaseRoute />} />
              <Route path="*" element={<ClientsPage me={me} />} />
            </Routes>
          )
        }
      />
    </Routes>
  );
}

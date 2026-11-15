import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { MOBILE_NAV, type Section } from '@/components/nav';
import { ModeIndicator } from '@/components/common';
import { DashboardView } from '@/components/views/DashboardView';
import { DocumentsView } from '@/components/views/DocumentsView';
import { ReviewView } from '@/components/views/ReviewView';
import { FlagsView } from '@/components/views/FlagsView';
import { TaxCalculationView } from '@/components/views/TaxCalculationView';
import { ChatView } from '@/components/views/ChatView';
import { ReportView } from '@/components/views/ReportView';
import { EvalsView } from '@/components/views/EvalsView';
import { ArchitectureView } from '@/components/views/ArchitectureView';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { cn } from '@/lib/utils';

const SECTIONS = new Set<Section>(MOBILE_NAV.map((n) => n.id));

function sectionFromHash(): Section {
  const h = window.location.hash.replace('#', '') as Section;
  return SECTIONS.has(h) ? h : 'dashboard';
}

const Index = () => {
  const [active, setActive] = useState<Section>(sectionFromHash);
  const { loadSample, caseFile } = useCase();

  useEffect(() => {
    const onHash = () => setActive(sectionFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (s: Section) => {
    window.location.hash = s;
    setActive(s);
    window.scrollTo({ top: 0 });
  };

  const views: Record<Section, JSX.Element> = {
    dashboard: <DashboardView go={go} />,
    documents: <DocumentsView go={go} />,
    review: <ReviewView />,
    flags: <FlagsView />,
    tax: <TaxCalculationView go={go} />,
    chat: <ChatView />,
    report: <ReportView />,
    evals: <EvalsView />,
    architecture: <ArchitectureView />,
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar activeSection={active} onSectionChange={go} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 print:hidden">
          <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {caseFile.client.name} <span className="text-muted-foreground font-normal">· PAN {caseFile.client.pan} · AY {caseFile.client.ay}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ModeIndicator />
              <Button variant="ghost" size="sm" onClick={loadSample} title="Reset to the sample case">
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset demo</span>
              </Button>
            </div>
          </div>
          <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">
            {MOBILE_NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={cn('whitespace-nowrap rounded-full px-3 py-1 text-xs', active === n.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <div className="mx-auto max-w-6xl">{views[active]}</div>
        </main>
      </div>
    </div>
  );
};

export default Index;

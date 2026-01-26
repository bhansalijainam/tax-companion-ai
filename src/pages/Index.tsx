import { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { UploadView } from '@/components/views/UploadView';
import { IncomeView } from '@/components/views/IncomeView';
import { ExpensesView } from '@/components/views/ExpensesView';
import { InvestmentsView } from '@/components/views/InvestmentsView';
import { FlagsView } from '@/components/views/FlagsView';
import { TaxCalculationView } from '@/components/views/TaxCalculationView';
import { ChatView } from '@/components/views/ChatView';
import { ReportView } from '@/components/views/ReportView';
import { Bell, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Index = () => {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderView = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'upload':
        return <UploadView />;
      case 'income':
        return <IncomeView />;
      case 'expenses':
        return <ExpensesView />;
      case 'investments':
        return <InvestmentsView />;
      case 'flags':
        return <FlagsView />;
      case 'tax':
        return <TaxCalculationView />;
      case 'chat':
        return <ChatView />;
      case 'report':
        return <ReportView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search clients, documents..." 
                className="pl-9 bg-muted/50 border-transparent focus:border-border"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Index;

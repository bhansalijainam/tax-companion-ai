import { useState } from 'react';
import {
  LayoutDashboard, FileStack, ListChecks, AlertTriangle, Calculator, MessageSquare, FileDown, Gauge, Workflow,
  ChevronLeft, ChevronRight, Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCase } from '@/state/CaseContext';
import type { Section } from './nav';


interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export function AppSidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { summary, caseFile } = useCase();

  const groups: { title: string; items: { id: Section; label: string; icon: typeof LayoutDashboard; badge?: number }[] }[] = [
    {
      title: 'Case',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'documents', label: 'Documents', icon: FileStack, badge: caseFile.documents.length },
        { id: 'review', label: 'Review facts', icon: ListChecks, badge: summary.pendingReview || undefined },
        { id: 'flags', label: 'Flags', icon: AlertTriangle, badge: summary.openFlags.length || undefined },
        { id: 'tax', label: 'Tax computation', icon: Calculator },
        { id: 'chat', label: 'Assistant', icon: MessageSquare },
        { id: 'report', label: 'Working paper', icon: FileDown },
      ],
    },
    {
      title: 'Under the hood',
      items: [
        { id: 'evals', label: 'Evals', icon: Gauge },
        { id: 'architecture', label: 'How it works', icon: Workflow },
      ],
    },
  ];

  return (
    <div className="hidden md:block bg-sidebar flex-shrink-0">
    <aside
      className={cn(
        'flex h-screen sticky top-0 bg-sidebar text-sidebar-foreground flex-col transition-all duration-300 border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Landmark className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div className="leading-tight">
              <span className="font-semibold">Tax Companion</span>
              <p className="text-[10px] text-sidebar-foreground/60">AI prep · CA decides</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="space-y-1">
            {!collapsed && <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/75">{g.title}</p>}
            {g.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground',
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 tabular-nums', isActive ? 'bg-sidebar-primary-foreground text-sidebar-primary' : 'bg-sidebar-accent')}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          <p className="font-medium text-sidebar-foreground/80">{caseFile.client.name}</p>
          <p>FY {caseFile.client.fy} · synthetic demo client</p>
        </div>
      )}
    </aside>
    </div>
  );
}

import { AlertTriangle, AlertCircle, Info, CheckCircle, MessageSquare } from 'lucide-react';
import { mockAnalysisState } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FlagsView() {
  const { flags } = mockAnalysisState;
  const unresolvedCount = flags.filter(f => !f.resolved).length;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      default:
        return <Info className="w-5 h-5 text-info" />;
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'flag-high';
      case 'medium':
        return 'flag-medium';
      default:
        return 'flag-low';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'missing-doc': 'Missing Documentation',
      'unclear-expense': 'Unclear Expense',
      'inconsistency': 'Data Inconsistency',
      'verification-needed': 'Verification Required',
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flagged Items</h1>
          <p className="text-muted-foreground mt-1">
            Items requiring clarification or additional documentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-warning/10 text-warning">
            {unresolvedCount} Unresolved
          </span>
        </div>
      </div>

      {/* Priority Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['high', 'medium', 'low'] as const).map((priority) => {
          const count = flags.filter(f => f.priority === priority && !f.resolved).length;
          return (
            <div key={priority} className={cn("stat-card border-l-4", getPriorityClass(priority))}>
              <div className="flex items-center gap-2">
                {getPriorityIcon(priority)}
                <span className="capitalize font-medium">{priority} Priority</span>
              </div>
              <p className="text-2xl font-bold mt-2">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Flags List */}
      <div className="space-y-4">
        {flags.map((flag) => (
          <div 
            key={flag.id}
            className={cn(
              "p-5 rounded-xl border-l-4 bg-card border border-border transition-all",
              getPriorityClass(flag.priority),
              flag.resolved && "opacity-60"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {flag.resolved ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  getPriorityIcon(flag.priority)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{flag.itemDescription}</h3>
                  <span className="section-badge bg-muted text-muted-foreground text-xs">
                    {getCategoryLabel(flag.category)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{flag.reason}</p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <MessageSquare className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-sm italic">"{flag.question}"</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                {!flag.resolved && (
                  <Button size="sm" variant="outline">
                    Mark Resolved
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {flags.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
          <p className="text-lg font-medium">All items verified</p>
          <p className="text-sm">No flags or issues detected in the analysis</p>
        </div>
      )}
    </div>
  );
}

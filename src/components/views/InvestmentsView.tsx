import { formatCurrency, getConfidenceColor } from '@/lib/formatters';
import { mockAnalysisState } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';

export function InvestmentsView() {
  const { investments } = mockAnalysisState;

  // Group by section
  const sections: Record<string, typeof investments> = {};
  investments.forEach(inv => {
    if (!sections[inv.section]) sections[inv.section] = [];
    sections[inv.section].push(inv);
  });

  const sectionLimits: Record<string, number> = {
    '80C': 150000,
    '80CCD': 50000,
    '80D': 25000,
    '80G': 100000,
    '80E': 0, // No limit
  };

  const sectionDescriptions: Record<string, string> = {
    '80C': 'Life Insurance, PPF, ELSS, NSC, etc.',
    '80CCD': 'NPS Contribution (additional)',
    '80D': 'Health Insurance Premium',
    '80G': 'Donations to Charitable Organizations',
    '80E': 'Education Loan Interest',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investment Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Deductions under Chapter VI-A
          </p>
        </div>
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(sections).map(([section, invList]) => {
          const total = invList.reduce((sum, i) => sum + i.amount, 0);
          const limit = sectionLimits[section] || 0;
          const utilized = limit > 0 ? Math.min((total / limit) * 100, 100) : 100;
          const remaining = limit > 0 ? Math.max(limit - total, 0) : 0;

          return (
            <div key={section} className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Section {section}</h3>
                  <p className="text-sm text-muted-foreground">{sectionDescriptions[section]}</p>
                </div>
                <span className={`section-badge section-${section.toLowerCase()}`}>
                  {section}
                </span>
              </div>

              <div className="space-y-3">
                {invList.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{inv.type}</p>
                      <p className="text-xs text-muted-foreground">{inv.documentRef}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold number-tabular">{formatCurrency(inv.amount)}</p>
                      <span className={`text-xs ${getConfidenceColor(inv.confidence)}`}>
                        {(inv.confidence * 100).toFixed(0)}% conf.
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {limit > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Limit Utilization</span>
                    <span className="font-medium">
                      {formatCurrency(total)} / {formatCurrency(limit)}
                    </span>
                  </div>
                  <Progress value={utilized} className="h-2" />
                  {remaining > 0 && (
                    <p className="text-xs text-accent mt-2">
                      ₹{remaining.toLocaleString('en-IN')} remaining to maximize deduction
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total Summary */}
      <div className="stat-card bg-accent/5 border-accent/20">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold">Total Investment Deductions</p>
            <p className="text-sm text-muted-foreground">Applicable under Chapter VI-A</p>
          </div>
          <p className="text-3xl font-bold number-tabular text-accent">
            {formatCurrency(investments.reduce((sum, i) => sum + i.amount, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}

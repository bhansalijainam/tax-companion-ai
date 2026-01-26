import { TrendingUp, TrendingDown, FileText, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { mockAnalysisState } from '@/data/mockData';

export function DashboardView() {
  const { income, expenses, investments, flags, taxCalculation, client } = mockAnalysisState;
  
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalDeductibleExpenses = expenses.filter(e => e.deductible).reduce((sum, e) => sum + e.amount, 0);
  const totalInvestments = investments.reduce((sum, i) => sum + i.amount, 0);
  const unresolvedFlags = flags.filter(f => !f.resolved).length;

  const stats = [
    { 
      label: 'Total Income', 
      value: formatCurrency(totalIncome), 
      change: '+12.5%', 
      positive: true,
      icon: TrendingUp,
      color: 'text-success'
    },
    { 
      label: 'Deductible Expenses', 
      value: formatCurrency(totalDeductibleExpenses), 
      change: 'Section 30-37', 
      positive: true,
      icon: FileText,
      color: 'text-accent'
    },
    { 
      label: 'Total Investments', 
      value: formatCurrency(totalInvestments), 
      change: '80C/80D/80CCD', 
      positive: true,
      icon: TrendingUp,
      color: 'text-section-80c'
    },
    { 
      label: 'Flagged Items', 
      value: unresolvedFlags.toString(), 
      change: 'Need attention', 
      positive: false,
      icon: AlertTriangle,
      color: 'text-warning'
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Client Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Analysis</h1>
          <p className="text-muted-foreground mt-1">
            {client?.name} • FY {client?.financialYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent">
            In Progress
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 number-tabular">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm">
                <span className={stat.positive ? 'text-success' : 'text-warning'}>
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tax Regime Comparison */}
      {taxCalculation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Tax Regime Comparison</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Old Regime</p>
                  <p className="text-sm text-muted-foreground">With deductions</p>
                </div>
                <p className="text-xl font-bold number-tabular">{formatCurrency(taxCalculation.taxOldRegime)}</p>
              </div>
              <div className="flex justify-between items-center p-4 rounded-lg bg-accent/10 border-2 border-accent">
                <div>
                  <p className="font-medium">New Regime</p>
                  <p className="text-sm text-accent">Recommended</p>
                </div>
                <p className="text-xl font-bold number-tabular text-accent">{formatCurrency(taxCalculation.taxNewRegime)}</p>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-success/10">
                <p className="font-medium text-success">Potential Savings</p>
                <p className="text-lg font-bold text-success">{formatCurrency(taxCalculation.savings)}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Income Breakdown</h3>
            <div className="space-y-3">
              {income.map((inc) => (
                <div key={inc.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{inc.source}</p>
                    <p className="text-xs text-muted-foreground capitalize">{inc.type.replace('-', ' ')}</p>
                  </div>
                  <p className="font-semibold number-tabular amount-positive">{formatCurrency(inc.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Upload Documents', icon: '📄' },
          { label: 'Review Flags', icon: '⚠️' },
          { label: 'Chat with AI', icon: '💬' },
          { label: 'Generate Report', icon: '📊' },
        ].map((action) => (
          <button
            key={action.label}
            className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all duration-200 hover:shadow-md text-center group"
          >
            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

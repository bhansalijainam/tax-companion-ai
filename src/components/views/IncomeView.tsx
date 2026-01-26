import { formatCurrency, getConfidenceColor } from '@/lib/formatters';
import { mockAnalysisState } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

export function IncomeView() {
  const { income } = mockAnalysisState;
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'salary': 'bg-chart-income/15 text-chart-income',
      'rental': 'bg-section-80c/15 text-section-80c',
      'capital-gains-short': 'bg-warning/15 text-warning',
      'capital-gains-long': 'bg-accent/15 text-accent',
      'business': 'bg-info/15 text-info',
      'interest': 'bg-muted text-muted-foreground',
      'other': 'bg-muted text-muted-foreground',
    };
    return colors[type] || colors['other'];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Income Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Extracted income from all uploaded documents
          </p>
        </div>
        <div className="stat-card !p-4">
          <p className="text-sm text-muted-foreground">Total Gross Income</p>
          <p className="text-2xl font-bold number-tabular text-success">{formatCurrency(totalIncome)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
              <th>Document Reference</th>
              <th className="text-center">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {income.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <p className="font-medium">{entry.source}</p>
                </td>
                <td>
                  <span className={`section-badge ${getTypeBadge(entry.type)}`}>
                    {entry.type.replace(/-/g, ' ')}
                  </span>
                </td>
                <td className="text-right">
                  <span className="font-semibold number-tabular amount-positive">
                    {formatCurrency(entry.amount)}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">{entry.documentRef}</span>
                </td>
                <td className="text-center">
                  <span className={`font-medium ${getConfidenceColor(entry.confidence)}`}>
                    {(entry.confidence * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30">
              <td colSpan={2} className="font-semibold">Total Gross Income</td>
              <td className="text-right font-bold text-lg number-tabular text-success">
                {formatCurrency(totalIncome)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Income Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['salary', 'rental', 'interest'].map((type) => {
          const typeIncome = income.filter(i => i.type === type);
          const total = typeIncome.reduce((sum, i) => sum + i.amount, 0);
          if (total === 0) return null;
          
          return (
            <div key={type} className="stat-card">
              <p className="text-sm text-muted-foreground capitalize">{type} Income</p>
              <p className="text-xl font-bold mt-1 number-tabular">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {typeIncome.length} source{typeIncome.length > 1 ? 's' : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

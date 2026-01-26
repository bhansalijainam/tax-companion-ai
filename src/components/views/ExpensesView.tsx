import { formatCurrency, formatDate, getConfidenceColor, getSectionBadgeClass } from '@/lib/formatters';
import { mockAnalysisState } from '@/data/mockData';
import { CheckCircle, XCircle } from 'lucide-react';

export function ExpensesView() {
  const { expenses } = mockAnalysisState;
  const deductibleTotal = expenses.filter(e => e.deductible).reduce((sum, e) => sum + e.amount, 0);
  const nonDeductibleTotal = expenses.filter(e => !e.deductible).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Categorized by tax deductibility
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Deductible Expenses</p>
          <p className="text-2xl font-bold mt-1 number-tabular text-success">{formatCurrency(deductibleTotal)}</p>
          <p className="text-xs text-success mt-2">Tax benefit available</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Non-Deductible</p>
          <p className="text-2xl font-bold mt-1 number-tabular text-destructive">{formatCurrency(nonDeductibleTotal)}</p>
          <p className="text-xs text-destructive mt-2">No tax benefit</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold mt-1 number-tabular">{formatCurrency(deductibleTotal + nonDeductibleTotal)}</p>
          <p className="text-xs text-muted-foreground mt-2">{expenses.length} items analyzed</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Tax Section</th>
              <th>Date</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Deductible</th>
              <th className="text-center">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">{entry.documentRef}</p>
                </td>
                <td>
                  <span className="text-sm">{entry.category}</span>
                </td>
                <td>
                  {entry.taxSection ? (
                    <span className={`section-badge ${getSectionBadgeClass(entry.taxSection)}`}>
                      {entry.taxSection}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">{formatDate(entry.date)}</span>
                </td>
                <td className="text-right">
                  <span className={`font-semibold number-tabular ${entry.deductible ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(entry.amount)}
                  </span>
                </td>
                <td className="text-center">
                  {entry.deductible ? (
                    <CheckCircle className="w-5 h-5 text-success mx-auto" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive mx-auto" />
                  )}
                </td>
                <td className="text-center">
                  <span className={`font-medium ${getConfidenceColor(entry.confidence)}`}>
                    {(entry.confidence * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

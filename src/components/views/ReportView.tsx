import { FileText, Download, FileSpreadsheet, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockAnalysisState } from '@/data/mockData';
import { formatCurrency } from '@/lib/formatters';

export function ReportView() {
  const { client, taxCalculation, income, expenses, investments, flags } = mockAnalysisState;

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalDeductible = expenses.filter(e => e.deductible).reduce((sum, e) => sum + e.amount, 0);
  const totalInvestments = investments.reduce((sum, i) => sum + i.amount, 0);
  const unresolvedFlags = flags.filter(f => !f.resolved).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Report</h1>
          <p className="text-muted-foreground mt-1">
            Export comprehensive analysis for client review
          </p>
        </div>
      </div>

      {/* Report Preview */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Report Preview</h3>
          <span className="text-sm text-muted-foreground">Generated just now</span>
        </div>

        <div className="border border-border rounded-lg p-6 bg-background">
          {/* Report Header */}
          <div className="text-center pb-6 border-b border-border mb-6">
            <h2 className="text-xl font-bold">Tax Analysis Report</h2>
            <p className="text-muted-foreground mt-1">Financial Year {client?.financialYear}</p>
            <p className="text-lg font-medium mt-2">{client?.name}</p>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Gross Income</p>
              <p className="font-bold number-tabular">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Deductions</p>
              <p className="font-bold number-tabular">{formatCurrency(totalInvestments + 50000)}</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Taxable Income</p>
              <p className="font-bold number-tabular">{formatCurrency(taxCalculation?.taxableIncome || 0)}</p>
            </div>
            <div className="text-center p-3 bg-accent/10 rounded-lg">
              <p className="text-xs text-accent">Tax Payable</p>
              <p className="font-bold number-tabular text-accent">{formatCurrency(taxCalculation?.taxNewRegime || 0)}</p>
            </div>
          </div>

          {/* Regime Recommendation */}
          <div className="p-4 bg-success/5 border border-success/20 rounded-lg mb-6">
            <p className="font-medium text-success">Recommended: New Tax Regime</p>
            <p className="text-sm text-muted-foreground mt-1">
              Potential savings of {formatCurrency(taxCalculation?.savings || 0)} compared to Old Regime
            </p>
          </div>

          {/* Sections Overview */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="font-semibold text-sm mb-2">Income Sources</h4>
              <ul className="text-sm space-y-1">
                {income.map(i => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-muted-foreground">{i.type}</span>
                    <span className="number-tabular">{formatCurrency(i.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Investment Deductions</h4>
              <ul className="text-sm space-y-1">
                {investments.map(i => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-muted-foreground">{i.section}</span>
                    <span className="number-tabular">{formatCurrency(i.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Flags */}
          {unresolvedFlags > 0 && (
            <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
              <p className="font-medium text-warning">{unresolvedFlags} Items Require Clarification</p>
              <ul className="text-sm mt-2 space-y-1">
                {flags.filter(f => !f.resolved).slice(0, 3).map(f => (
                  <li key={f.id} className="text-muted-foreground">• {f.itemDescription}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Export Options */}
      <div className="stat-card">
        <h3 className="text-lg font-semibold mb-4">Export Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-6 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all duration-200 hover:shadow-md group text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-destructive" />
              </div>
              <span className="font-medium">PDF Report</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Professional formatted report for client presentation
            </p>
          </button>

          <button className="p-6 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all duration-200 hover:shadow-md group text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-success" />
              </div>
              <span className="font-medium">Excel Workbook</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Detailed data with separate sheets for each section
            </p>
          </button>

          <button className="p-6 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all duration-200 hover:shadow-md group text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-info" />
              </div>
              <span className="font-medium">Email to Client</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Send report directly with clarification questions
            </p>
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download All
          </Button>
          <Button>
            Generate & Send
          </Button>
        </div>
      </div>
    </div>
  );
}

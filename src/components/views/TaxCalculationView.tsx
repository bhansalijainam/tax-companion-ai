import { formatCurrency } from '@/lib/formatters';
import { mockAnalysisState } from '@/data/mockData';
import { ArrowRight, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

export function TaxCalculationView() {
  const { taxCalculation, income, investments } = mockAnalysisState;
  
  if (!taxCalculation) return null;

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalInvestments = investments.reduce((sum, i) => sum + i.amount, 0);

  const oldRegimeSlabs = [
    { range: 'Up to ₹2,50,000', rate: '0%', amount: 0 },
    { range: '₹2,50,001 - ₹5,00,000', rate: '5%', amount: 12500 },
    { range: '₹5,00,001 - ₹10,00,000', rate: '20%', amount: 100000 },
    { range: 'Above ₹10,00,000', rate: '30%', amount: 82500 },
  ];

  const newRegimeSlabs = [
    { range: 'Up to ₹3,00,000', rate: '0%', amount: 0 },
    { range: '₹3,00,001 - ₹6,00,000', rate: '5%', amount: 15000 },
    { range: '₹6,00,001 - ₹9,00,000', rate: '10%', amount: 30000 },
    { range: '₹9,00,001 - ₹12,00,000', rate: '15%', amount: 45000 },
    { range: '₹12,00,001 - ₹15,00,000', rate: '20%', amount: 60000 },
    { range: 'Above ₹15,00,000', rate: '30%', amount: 24000 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tax Calculation</h1>
        <p className="text-muted-foreground mt-1">
          Comparison between Old and New Tax Regimes
        </p>
      </div>

      {/* Income Summary */}
      <div className="stat-card">
        <h3 className="text-lg font-semibold mb-4">Income Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Gross Income</p>
            <p className="text-xl font-bold number-tabular">{formatCurrency(taxCalculation.grossIncome)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Total Deductions</p>
            <p className="text-xl font-bold number-tabular text-accent">{formatCurrency(taxCalculation.totalDeductions)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Taxable Income</p>
            <p className="text-xl font-bold number-tabular">{formatCurrency(taxCalculation.taxableIncome)}</p>
          </div>
          <div className="p-4 rounded-lg bg-success/10">
            <p className="text-sm text-success">Investments (Ch VI-A)</p>
            <p className="text-xl font-bold number-tabular text-success">{formatCurrency(totalInvestments)}</p>
          </div>
        </div>
      </div>

      {/* Regime Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Old Regime */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Old Tax Regime</h3>
            <span className="section-badge bg-muted text-muted-foreground">With Deductions</span>
          </div>
          <div className="space-y-2 mb-4">
            {oldRegimeSlabs.filter(s => s.amount > 0).map((slab, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">{slab.range}</span>
                <span className="font-medium">{slab.rate} = {formatCurrency(slab.amount)}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Tax Liability</span>
              <span className="text-2xl font-bold number-tabular">{formatCurrency(taxCalculation.taxOldRegime)}</span>
            </div>
          </div>
        </div>

        {/* New Regime */}
        <div className="stat-card border-2 border-accent">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">New Tax Regime</h3>
            <span className="section-badge bg-accent/15 text-accent">
              <CheckCircle className="w-3 h-3 mr-1" />
              Recommended
            </span>
          </div>
          <div className="space-y-2 mb-4">
            {newRegimeSlabs.filter(s => s.amount > 0).map((slab, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">{slab.range}</span>
                <span className="font-medium">{slab.rate} = {formatCurrency(slab.amount)}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-accent/30">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Tax Liability</span>
              <span className="text-2xl font-bold number-tabular text-accent">{formatCurrency(taxCalculation.taxNewRegime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Savings Summary */}
      <div className="stat-card bg-gradient-to-r from-success/10 to-accent/10 border-success/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-lg font-semibold">Potential Tax Savings</p>
              <p className="text-sm text-muted-foreground">
                By choosing {taxCalculation.recommendedRegime === 'new' ? 'New' : 'Old'} Regime
              </p>
            </div>
          </div>
          <p className="text-3xl font-bold text-success number-tabular">
            {formatCurrency(taxCalculation.savings)}
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="stat-card">
        <h3 className="text-lg font-semibold mb-4">AI Recommendation</h3>
        <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-sm leading-relaxed">
            Based on the analysis, the <strong>New Tax Regime</strong> is recommended for this client. 
            The deductions claimed under Chapter VI-A (₹{totalInvestments.toLocaleString('en-IN')}) 
            are not sufficient to offset the benefit of lower tax slabs in the new regime. 
            The client can save <strong>₹{taxCalculation.savings.toLocaleString('en-IN')}</strong> by opting 
            for the New Regime.
          </p>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> If the client increases 80C investments by ₹30,000 (remaining limit), 
            the old regime may become more beneficial. Consider advising investment before March 31.
          </p>
        </div>
      </div>
    </div>
  );
}

import { Printer, AlertTriangle } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { PageHeader } from '@/components/common';
import { inr } from '@/lib/formatters';
import { FIELDS } from '@/domain/fields';
import { AY, FY } from '@/engine/rules';
import { Button } from '@/components/ui/button';

/** Working paper: everything a reviewing partner needs to sign off, generated deterministically. */
export function ReportView() {
  const { caseFile, summary } = useCase();
  const { comparison: cmp, flags, pendingReview } = summary;
  const rec = cmp[cmp.recommended];
  const resolved = flags.filter((f) => f.state !== 'open');
  const open = flags.filter((f) => f.state === 'open');
  const docName = (id: string) => caseFile.documents.find((d) => d.id === id)?.name ?? 'Entered by reviewer';
  const ready = pendingReview === 0 && open.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Working paper"
        subtitle="Generated from the case file, not by the model: computation, evidence index, flag resolutions and audit trail. Print or save as PDF for the client file."
        actions={<Button onClick={() => window.print()}><Printer className="w-4 h-4" /> Print / PDF</Button>}
      />

      {!ready && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex gap-2 print:hidden">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          Draft: {pendingReview} unreviewed facts and {open.length} open flags. The paper is marked DRAFT until both are zero.
        </div>
      )}

      <article className="stat-card space-y-6 text-sm">
        <header className="border-b border-border pb-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{ready ? 'Final' : 'Draft'} · Income-tax working paper</p>
          <h2 className="text-xl font-bold mt-1">{caseFile.client.name}</h2>
          <p className="text-muted-foreground">PAN {caseFile.client.pan} · FY {FY} (AY {AY}) · prepared {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </header>

        <section>
          <h3 className="font-semibold mb-2">1. Conclusion</h3>
          <p>
            File under the <strong>{cmp.recommended} regime</strong>. Total tax liability {inr(rec.totalTax)} against {inr(rec.taxesPaid)} TDS,
            leaving {rec.netPayable >= 0 ? `${inr(rec.netPayable)} payable` : `a refund of ${inr(-rec.netPayable)}`}.
            The {cmp.recommended === 'old' ? 'new' : 'old'} regime would cost {inr(cmp.savings)} more.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-2">2. Computation summary</h3>
          <table className="w-full">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border"><th className="py-1 font-medium">Line</th><th className="py-1 text-right font-medium">Old</th><th className="py-1 text-right font-medium">New</th></tr></thead>
            <tbody className="number-tabular">
              {[
                ['Gross total income', cmp.old.grossTotalIncome, cmp.new.grossTotalIncome],
                ['Chapter VI-A deductions', cmp.old.totalDeductions, cmp.new.totalDeductions],
                ['Total income', cmp.old.totalIncome, cmp.new.totalIncome],
                ['Tax incl. cess', cmp.old.totalTax, cmp.new.totalTax],
                ['Net payable / (refund)', cmp.old.netPayable, cmp.new.netPayable],
              ].map(([l, o, n]) => (
                <tr key={l as string} className="border-b border-border/40"><td className="py-1">{l}</td><td className="py-1 text-right">{inr(o as number)}</td><td className="py-1 text-right">{inr(n as number)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="font-semibold mb-2">3. Evidence index</h3>
          <table className="w-full">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border"><th className="py-1 font-medium">Fact</th><th className="py-1 font-medium">Value</th><th className="py-1 font-medium">Source</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>
              {caseFile.facts.map((f) => (
                <tr key={f.id} className="border-b border-border/40 align-top">
                  <td className="py-1 pr-2">{FIELDS[f.field].label}<p className="text-xs text-muted-foreground">{f.label}</p></td>
                  <td className="py-1 pr-2 number-tabular whitespace-nowrap">{typeof f.value === 'number' ? inr(f.value) : String(f.value)}</td>
                  <td className="py-1 pr-2 text-xs">{docName(f.docId)}</td>
                  <td className="py-1 text-xs capitalize">{f.status}{f.origin === 'human' ? ' (CA)' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="font-semibold mb-2">4. Issues and resolutions</h3>
          {flags.length === 0 && <p className="text-muted-foreground">None.</p>}
          <ul className="space-y-1">
            {[...open, ...resolved].map((f) => (
              <li key={f.id}><strong className="capitalize">[{f.state}]</strong> {f.title}{f.note ? ` — ${f.note}` : ''}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="font-semibold mb-2">5. Audit trail</h3>
          <ul className="space-y-0.5 text-xs text-muted-foreground font-mono">
            {caseFile.audit.slice(-40).map((e, i) => (
              <li key={i}>{new Date(e.at).toLocaleString('en-IN')} · {e.actor.toUpperCase()} · {e.action} · {e.detail}</li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Prepared with AI-assisted extraction. Figures computed by a deterministic FY {FY} engine; every extracted fact links to its source document. Reviewed by: ____________________ (CA, M.No. ________)
        </footer>
      </article>
    </div>
  );
}

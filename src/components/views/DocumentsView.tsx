import { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, RefreshCw, Trash2, Eye } from 'lucide-react';
import { useCase } from '@/state/CaseContext';
import { PageHeader } from '@/components/common';
import type { Section } from '@/components/AppSidebar';
import { DOC_KIND_LABEL, type CaseDocument } from '@/domain/types';
import { formatFileSize } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function DocumentsView({ go }: { go: (s: Section) => void }) {
  const { caseFile, uploadFiles, runExtraction, dispatch, mode, startEmpty, loadSample } = useCase();
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<CaseDocument | null>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(e.dataTransfer.files));
  }, [uploadFiles]);

  const factsFor = (id: string) => caseFile.facts.filter((f) => f.docId === id).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Documents"
        subtitle={mode === 'live'
          ? 'Uploads are sent to the server, which asks the model for structured facts with verbatim citations. Every citation is checked against the document text.'
          : 'Demo mode reads text documents with the rules baseline. Switch to live mode to extract from PDFs and images with Claude.'}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={startEmpty}>Start empty case</Button>
            <Button variant="outline" size="sm" onClick={loadSample}>Load sample pack</Button>
          </>
        }
      />

      <div
        className={cn('border-2 border-dashed rounded-xl p-8 text-center transition-all', dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
            <Upload className={cn('w-7 h-7', dragging ? 'text-accent' : 'text-muted-foreground')} />
          </div>
          <p className="font-medium">Drop client documents here</p>
          <p className="text-sm text-muted-foreground">
            {mode === 'live' ? 'Form 16, AIS, bank statements, receipts — PDF, PNG, JPG or text (max ~3 MB each)' : 'Text files (.txt) in demo mode. Try pasting one of the sample documents into a file.'}
          </p>
          <label className="cursor-pointer">
            <input
              type="file" className="hidden" multiple
              accept={mode === 'live' ? '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv' : '.txt,.csv,.md'}
              onChange={(e) => { if (e.target.files) void uploadFiles(Array.from(e.target.files)); e.target.value = ''; }}
            />
            <Button variant="outline" asChild><span>Browse files</span></Button>
          </label>
        </div>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">On file ({caseFile.documents.length})</h3>
          {caseFile.facts.length > 0 && <Button size="sm" onClick={() => go('review')}>Review {caseFile.facts.length} facts</Button>}
        </div>
        {caseFile.documents.length === 0 && <p className="p-5 text-sm text-muted-foreground">No documents yet.</p>}
        <ul className="divide-y divide-border">
          {caseFile.documents.map((d) => (
            <li key={d.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-shrink-0">
                {d.status === 'extracted' ? <CheckCircle className="w-5 h-5 text-success" />
                  : d.status === 'error' ? <AlertCircle className="w-5 h-5 text-destructive" />
                  : d.status === 'extracting' ? <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  : <FileText className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-sm truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOC_KIND_LABEL[d.kind]} · {formatFileSize(d.size)}
                  {d.status === 'extracted' && ` · ${factsFor(d.id)} facts · ${d.extractor}${d.latencyMs ? ` · ${(d.latencyMs / 1000).toFixed(1)}s` : ''}`}
                  {d.status === 'extracting' && ' · extracting…'}
                </p>
                {d.error && <p className="text-xs text-destructive mt-1">{d.error}</p>}
              </div>
              <div className="flex items-center gap-1">
                {d.text && (
                  <Button variant="ghost" size="icon" onClick={() => setViewing(d)} title="View text"><Eye className="w-4 h-4" /></Button>
                )}
                <Button variant="ghost" size="icon" disabled={d.status === 'extracting'} onClick={() => void runExtraction(d)} title={`Re-extract with ${mode === 'live' ? 'live AI' : 'rules baseline'}`}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => dispatch({ type: 'removeDocument', id: d.id })} title="Remove"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle></DialogHeader>
          <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-4 max-h-[60vh] overflow-auto font-mono">{viewing?.text}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

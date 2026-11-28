import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { CaseDocument, CaseFile } from '@/domain/types';
import type { CaseStore } from './caseStore';

// Live mode, and an extractor we can hold open to model a slow read
const pending: (() => void)[] = [];
const extractCalls: string[] = [];
vi.mock('@/ai/client', () => ({
  fetchLiveStatus: async () => ({ live: true, provider: 'test', model: 'test', signInRequired: false }),
  askAssistant: vi.fn(),
  extractDocument: (doc: CaseDocument) => {
    extractCalls.push(doc.id);
    return new Promise((resolve) => pending.push(() => resolve({ output: { documentType: 'other', summary: '', facts: [], ambiguities: [] }, extractor: 'test', latencyMs: 0 })));
  },
}));

const { CaseProvider, useCase } = await import('./CaseContext');

const clientDoc = (id: string, status: CaseDocument['status']): CaseDocument =>
  ({ id, name: `${id}.pdf`, kind: 'form16', mimeType: 'application/pdf', size: 10, status, source: 'client', text: 'x' });

function storeWith(c: CaseFile): CaseStore {
  return { kind: 'local', initial: () => c, load: async () => ({ data: c, status: 'draft' }), save: async () => ({ ok: true }) };
}

describe('automatic reading of client files', () => {
  it('never starts a second read of a document already being read manually', async () => {
    const c: CaseFile = { client: { name: 'A', pan: '', fy: '2024-25', ay: '2025-26' }, documents: [clientDoc('done', 'extracted')], facts: [], modelFlags: [], flagState: {}, audit: [] };
    const store = storeWith(c);
    const wrapper = ({ children }: { children: ReactNode }) => <CaseProvider store={store}>{children}</CaseProvider>;
    const { result } = renderHook(() => useCase(), { wrapper });
    await waitFor(() => expect(result.current.mode).toBe('live'));

    // Manual re-read of the extracted document, still running…
    act(() => { void result.current.runExtraction(result.current.caseFile.documents[0]); });
    // …when another client document arrives, which re-runs the auto-reader
    act(() => { result.current.dispatch({ type: 'addDocument', doc: clientDoc('new', 'queued') }); });
    await waitFor(() => expect(extractCalls).toContain('new'));

    expect(extractCalls.filter((id) => id === 'done')).toHaveLength(1);
    pending.forEach((r) => r());
  });

  it('resumes a document left "extracting" by a reload', async () => {
    extractCalls.length = 0;
    const c: CaseFile = { client: { name: 'A', pan: '', fy: '2024-25', ay: '2025-26' }, documents: [clientDoc('stuck', 'extracting')], facts: [], modelFlags: [], flagState: {}, audit: [] };
    const store = storeWith(c);
    const wrapper = ({ children }: { children: ReactNode }) => <CaseProvider store={store}>{children}</CaseProvider>;
    renderHook(() => useCase(), { wrapper });
    await waitFor(() => expect(extractCalls).toEqual(['stuck']));
    pending.forEach((r) => r());
  });
});

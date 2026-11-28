import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { askAssistant, extractDocument, fetchLiveStatus, LiveStatus, Mode } from '@/ai/client';
import type { AgentResult } from '@/ai/agent/runAgent';
import { applyExtraction, buildSampleCase, emptyCase, ExtractionApplied } from '@/ai/pipeline';
import { detectKind } from '@/ai/extraction/rulesExtractor';
import { caseSummary } from '@/domain/caseFile';
import type { FactField } from '@/domain/fields';
import { FIELDS } from '@/domain/fields';
import type { CaseDocument, CaseFile, ClientProfile, Fact, FlagState } from '@/domain/types';
import { evaluateChecklist } from '@/domain/checklist';
import type { SampleDocument } from '@/fixtures/sampleDocuments';
import { CaseStatus, CaseStore, LocalCaseStore, Role, SaveResult } from './caseStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: AgentResult;
  error?: string;
  mode?: Mode;
}

type Action =
  | { type: 'reset'; caseFile: CaseFile }
  | { type: 'addDocument'; doc: CaseDocument }
  | { type: 'patchDocument'; id: string; patch: Partial<CaseDocument> }
  | { type: 'removeDocument'; id: string }
  | { type: 'applyExtraction'; docId: string; applied: ExtractionApplied }
  | { type: 'setFactStatus'; ids: string[]; status: Fact['status'] }
  | { type: 'editFact'; id: string; value: number | boolean | string }
  | { type: 'addFact'; fact: Fact }
  | { type: 'setFlagState'; id: string; status: FlagState['status']; note?: string }
  | { type: 'setProfile'; profile: ClientProfile }
  | { type: 'setContact'; phone?: string; email?: string }
  | { type: 'log'; action: string; detail: string };

const now = () => new Date().toISOString();

function reducer(c: CaseFile, a: Action): CaseFile {
  const audit = (actor: 'system' | 'ai' | 'ca', action: string, detail: string) => [...c.audit, { at: now(), actor, action, detail }];
  switch (a.type) {
    case 'reset':
      return a.caseFile;
    case 'addDocument':
      return { ...c, documents: [...c.documents, a.doc], audit: audit('ca', 'document.added', a.doc.name) };
    case 'patchDocument':
      return { ...c, documents: c.documents.map((d) => (d.id === a.id ? { ...d, ...a.patch } : d)) };
    case 'removeDocument': {
      const name = c.documents.find((d) => d.id === a.id)?.name ?? a.id;
      return {
        ...c,
        documents: c.documents.filter((d) => d.id !== a.id),
        facts: c.facts.filter((f) => f.docId !== a.id),
        modelFlags: c.modelFlags.filter((f) => f.docId !== a.id),
        audit: audit('ca', 'document.removed', name),
      };
    }
    case 'applyExtraction': {
      const doc = c.documents.find((d) => d.id === a.docId);
      return {
        ...c,
        documents: c.documents.map((d) => (d.id === a.docId ? { ...d, ...a.applied.doc } : d)),
        facts: [...c.facts.filter((f) => f.docId !== a.docId), ...a.applied.facts],
        modelFlags: [...c.modelFlags.filter((f) => f.docId !== a.docId), ...a.applied.flags],
        audit: audit('ai', 'document.extracted', `${doc?.name}: ${a.applied.facts.length} facts, ${a.applied.flags.length} questions (${a.applied.doc.extractor})`),
      };
    }
    case 'setFactStatus': {
      const ids = new Set(a.ids);
      return {
        ...c,
        facts: c.facts.map((f) => (ids.has(f.id) ? { ...f, status: a.status } : f)),
        audit: audit('ca', `fact.${a.status}`, `${a.ids.length} fact${a.ids.length > 1 ? 's' : ''}`),
      };
    }
    case 'editFact': {
      const f = c.facts.find((x) => x.id === a.id);
      if (!f) return c;
      return {
        ...c,
        facts: c.facts.map((x) => (x.id === a.id ? { ...x, value: a.value, originalValue: x.originalValue ?? x.value, origin: 'human', status: 'accepted', confidence: 1 } : x)),
        audit: audit('ca', 'fact.edited', `${FIELDS[f.field].label}: ${String(f.value)} → ${String(a.value)}`),
      };
    }
    case 'addFact':
      return { ...c, facts: [...c.facts, a.fact], audit: audit('ca', 'fact.added', `${FIELDS[a.fact.field].label}: ${String(a.fact.value)} — ${a.fact.label}`) };
    case 'setFlagState':
      return {
        ...c,
        flagState: { ...c.flagState, [a.id]: { status: a.status, note: a.note, at: now() } },
        audit: audit('ca', `flag.${a.status}`, `${a.id}${a.note ? ` — ${a.note}` : ''}`),
      };
    case 'setProfile': {
      const changed = (Object.keys(a.profile) as (keyof ClientProfile)[]).filter((k) => c.profile?.[k] !== a.profile[k]);
      if (!changed.length && c.profile) return c;
      return { ...c, profile: a.profile, audit: audit('ca', 'profile.updated', changed.map((k) => `${k}: ${String(a.profile[k])}`).join(', ') || 'profile confirmed') };
    }
    case 'log':
      return { ...c, audit: audit('ca', a.action, a.detail) };
    case 'setContact':
      if ((a.phone ?? '') === (c.client.phone ?? '') && (a.email ?? '') === (c.client.email ?? '')) return c;
      return { ...c, client: { ...c.client, phone: a.phone || undefined, email: a.email || undefined }, audit: audit('ca', 'contact.updated', 'Client contact details changed') };
  }
}

function readFile(file: File): Promise<{ text?: string; base64?: string }> {
  const isText = file.type.startsWith('text/') || /\.(txt|csv|md)$/i.test(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    if (isText) {
      reader.onload = () => resolve({ text: String(reader.result) });
      reader.readAsText(file);
    } else {
      reader.onload = () => resolve({ base64: String(reader.result).split(',')[1] });
      reader.readAsDataURL(file);
    }
  });
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'locked' | 'error';

const SAVE_DEBOUNCE_MS = 800;

function useCaseState(store: CaseStore) {
  const [caseFile, dispatch] = useReducer(reducer, undefined, () => store.initial() ?? emptyCase());
  const [ready, setReady] = useState(store.initial() !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<CaseStatus | undefined>();
  const [role, setRole] = useState<Role | undefined>();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const lastSaved = useRef<CaseFile | null>(null);
  const failedFor = useRef<CaseFile | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [preferDemo, setPreferDemo] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const caseRef = useRef(caseFile);
  caseRef.current = caseFile;

  useEffect(() => {
    fetchLiveStatus().then(setStatus);
  }, []);

  // Load from the store (async for the server store)
  useEffect(() => {
    let cancelled = false;
    store.load().then(
      (loaded) => {
        if (cancelled) return;
        lastSaved.current = loaded.data;
        dispatch({ type: 'reset', caseFile: loaded.data });
        setCaseStatus(loaded.status);
        setRole(loaded.role);
        setReady(true);
      },
      (e) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)),
    );
    return () => { cancelled = true; };
  }, [store]);

  // Persist changes. The demo saves immediately; the server store is debounced and version-checked.
  useEffect(() => {
    if (!ready || caseFile === lastSaved.current) return;
    if (saveState === 'conflict' || saveState === 'locked') return; // wait for the user to reload / reopen
    if (saveState === 'error' && failedFor.current === caseFile) return; // retry only after another change
    const delay = store.kind === 'api' ? SAVE_DEBOUNCE_MS : 0;
    const t = setTimeout(async () => {
      setSaveState('saving');
      const r: SaveResult = await store.save(caseFile);
      if (!('reason' in r)) {
        lastSaved.current = caseFile;
        setSaveState('saved');
        setSaveMessage(null);
      } else {
        failedFor.current = caseFile;
        setSaveState(r.reason);
        setSaveMessage(r.message);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [caseFile, ready, store, saveState]);

  const changeStatus = useCallback(async (next: CaseStatus) => {
    if (!store.setStatus) return;
    const r = await store.setStatus(next);
    if (!('reason' in r)) {
      setCaseStatus(r.status);
      if (saveState === 'locked') setSaveState('idle');
    } else {
      setSaveMessage(r.message);
    }
  }, [store, saveState]);

  // Signed-in firms use live AI only when the server allows it for members; the public demo stays scripted
  const liveAllowed = status?.live && (!status.signInRequired || store.kind === 'api');
  const mode: Mode = liveAllowed && !preferDemo ? 'live' : 'demo';
  const summary = useMemo(() => caseSummary(caseFile), [caseFile]);
  const checklist = useMemo(() => evaluateChecklist(caseFile, caseStatus), [caseFile, caseStatus]);

  const runExtraction = useCallback(async (doc: CaseDocument) => {
    dispatch({ type: 'patchDocument', id: doc.id, patch: { status: 'extracting', error: undefined } });
    try {
      const run = await extractDocument(doc, mode);
      dispatch({ type: 'applyExtraction', docId: doc.id, applied: applyExtraction(doc, run) });
    } catch (e) {
      dispatch({ type: 'patchDocument', id: doc.id, patch: { status: 'error', error: e instanceof Error ? e.message : String(e) } });
    }
  }, [mode]);

  const uploadFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const content = await readFile(file);
      const doc: CaseDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        kind: content.text ? detectKind(content.text) : 'other',
        mimeType: file.type || 'text/plain',
        size: file.size,
        ...content,
        status: 'queued',
      };
      dispatch({ type: 'addDocument', doc });
      void runExtraction(doc);
    }
  }, [runExtraction]);

  /** Demo only: a sample document arrives as if the client had uploaded it. */
  const addSampleDocument = useCallback((d: SampleDocument) => {
    const doc: CaseDocument = { id: d.id, name: d.name, kind: d.kind, mimeType: 'text/plain', size: d.text.length, text: d.text, status: 'queued' };
    dispatch({ type: 'addDocument', doc });
    void runExtraction(doc);
  }, [runExtraction]);

  const sendChat = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', content: text };
    const history = chat.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setChat((prev) => [...prev, userMsg]);
    setChatBusy(true);
    try {
      const result = await askAssistant(caseRef.current, history, text, mode);
      setChat((prev) => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: result.answer, result, mode }]);
    } catch (e) {
      setChat((prev) => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: '', error: e instanceof Error ? e.message : String(e), mode }]);
    } finally {
      setChatBusy(false);
    }
  }, [chat, mode]);

  const addManualFact = useCallback((field: FactField, value: number | boolean | string, note: string) => {
    dispatch({
      type: 'addFact',
      fact: {
        id: `manual-${Date.now()}`, docId: 'manual', field, value, label: note || 'Entered by reviewer', quote: '',
        confidence: 1, origin: 'human', status: 'accepted', grounded: null,
      },
    });
  }, []);

  return {
    store, ready, loadError, caseStatus, role, saveState, saveMessage, changeStatus,
    caseFile, dispatch, summary, checklist, status, mode, preferDemo, setPreferDemo,
    chat, chatBusy, sendChat, clearChat: () => setChat([]),
    uploadFiles, runExtraction, addManualFact, addSampleDocument,
    setProfile: (profile: ClientProfile) => dispatch({ type: 'setProfile', profile }),
    setContact: (phone?: string, email?: string) => dispatch({ type: 'setContact', phone, email }),
    logEvent: (action: string, detail: string) => dispatch({ type: 'log', action, detail }),
    loadSample: () => { dispatch({ type: 'reset', caseFile: buildSampleCase() }); setChat([]); },
    startEmpty: () => { dispatch({ type: 'reset', caseFile: emptyCase() }); setChat([]); },
  };
}

type CaseCtx = ReturnType<typeof useCaseState>;
const Ctx = createContext<CaseCtx | null>(null);

const defaultStore = new LocalCaseStore();

export function CaseProvider({ children, store = defaultStore }: { children: ReactNode; store?: CaseStore }) {
  const value = useCaseState(store);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCase() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCase must be used inside CaseProvider');
  return v;
}

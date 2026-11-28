/**
 * The public demo's practice: ten fictional clients kept in this browser.
 * Each client's case is stored under its own key, the browser equivalent of the
 * firm-and-client scoping the server enforces. Nothing leaves the device.
 */
import { evaluateChecklist, summarizeChecklist, type ChecklistSummary } from '../domain/checklist';
import type { CaseFile, ClientProfile } from '../domain/types';
import { buildPracticeCase, PRACTICE_PERSONAS, type Persona } from '../fixtures/samplePractice';
import type { CaseStatus, CaseStore, LoadedCase, SaveResult } from './caseStore';

const PREFIX = 'tax-companion:practice:v1';
const INDEX_KEY = `${PREFIX}:index`;
const caseKey = (id: string) => `${PREFIX}:case:${id}`;

interface IndexEntry { id: string; status: CaseStatus; createdAt: string; }

export interface PracticeRow {
  id: string;
  name: string;
  pan: string;
  fy: string;
  status: CaseStatus;
  summary: ChecklistSummary;
  updatedAt: string;
}

const read = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, v: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked: demo still works in memory */ }
};
const withoutBinaries = (c: CaseFile): CaseFile => ({ ...c, documents: c.documents.map(({ base64: _b, ...d }) => d) });

/** In-memory fallback when localStorage is unavailable (private mode, thumbnails) */
const memory = new Map<string, unknown>();
const get = <T,>(key: string): T | null => read<T>(key) ?? (memory.get(key) as T | undefined) ?? null;
const put = (key: string, v: unknown) => { memory.set(key, v); write(key, v); };

export const demoPractice = {
  seed(): IndexEntry[] {
    const now = new Date().toISOString();
    const entries = PRACTICE_PERSONAS.map((p) => {
      put(caseKey(p.id), buildPracticeCase(p));
      return { id: p.id, status: (p.final ? 'final' : 'draft') as CaseStatus, createdAt: now };
    });
    put(INDEX_KEY, entries);
    return entries;
  },
  index(): IndexEntry[] {
    return get<IndexEntry[]>(INDEX_KEY) ?? this.seed();
  },
  reset() { this.seed(); },
  persona(id: string): Persona | undefined { return PRACTICE_PERSONAS.find((p) => p.id === id); },
  getCase(id: string): CaseFile | null {
    if (!this.index().some((e) => e.id === id)) return null;
    return get<CaseFile>(caseKey(id));
  },
  status(id: string): CaseStatus { return this.index().find((e) => e.id === id)?.status ?? 'draft'; },
  saveCase(id: string, c: CaseFile) { put(caseKey(id), withoutBinaries(c)); },
  setStatus(id: string, status: CaseStatus) {
    put(INDEX_KEY, this.index().map((e) => (e.id === id ? { ...e, status } : e)));
  },
  rows(): PracticeRow[] {
    return this.index().flatMap((e) => {
      const c = get<CaseFile>(caseKey(e.id));
      if (!c) return [];
      const summary = summarizeChecklist(evaluateChecklist(c, e.status));
      const updatedAt = c.audit.at(-1)?.at ?? e.createdAt;
      return [{ id: e.id, name: c.client.name, pan: c.client.pan, fy: c.client.fy, status: e.status, summary, updatedAt }];
    });
  },
  createClient(input: { name: string; pan: string; phone: string; profile: ClientProfile }): string {
    const id = `n${Date.now().toString(36)}`;
    const c: CaseFile = {
      client: { name: input.name, pan: input.pan, fy: '2024-25', ay: '2025-26', phone: input.phone || undefined },
      profile: input.profile, documents: [], facts: [], modelFlags: [], flagState: {},
      audit: [{ at: new Date().toISOString(), actor: 'ca', action: 'case.created', detail: `${input.name}, FY 2024-25` }],
    };
    put(caseKey(id), c);
    put(INDEX_KEY, [{ id, status: 'draft', createdAt: new Date().toISOString() }, ...this.index()]);
    return id;
  },
};

/** CaseStore for one demo client. The demo user is a partner, so "Mark final" works. */
export class DemoClientCaseStore implements CaseStore {
  readonly kind = 'local';
  readonly demoClientId: string;
  constructor(id: string) { this.demoClientId = id; }
  initial(): CaseFile | null { return demoPractice.getCase(this.demoClientId); }
  async load(): Promise<LoadedCase> {
    const data = this.initial();
    if (!data) throw new Error('This demo client does not exist. It may have been removed when the demo was reset.');
    return { data, status: demoPractice.status(this.demoClientId), role: 'partner' };
  }
  async save(data: CaseFile): Promise<SaveResult> {
    if (demoPractice.status(this.demoClientId) === 'final') return { ok: false, reason: 'locked', message: 'This case is final.' };
    demoPractice.saveCase(this.demoClientId, data);
    return { ok: true };
  }
  async setStatus(status: CaseStatus) {
    demoPractice.setStatus(this.demoClientId, status);
    return { ok: true as const, status };
  }
}

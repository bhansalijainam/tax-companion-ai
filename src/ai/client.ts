/**
 * Browser-side AI service. Talks to the server in live mode; runs the same pipeline
 * locally (rules extractor + scripted provider) in demo mode.
 */
import type { CaseDocument, CaseFile } from '../domain/types';
import { runAgent, type AgentResult, type ChatTurn } from './agent/runAgent';
import type { ExtractorRun } from './extraction/llmExtractor';
import { RulesExtractor } from './extraction/rulesExtractor';
import { ScriptedProvider } from './llm/providers/scripted';

export interface LiveStatus {
  live: boolean;
  provider: string | null;
  model: string | null;
  accessTokenRequired: boolean;
}

export type Mode = 'live' | 'demo';

const TOKEN_KEY = 'tax-companion:access-token';

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setAccessToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: token lasts for this page only */
  }
}

export async function fetchLiveStatus(): Promise<LiveStatus> {
  try {
    const res = await fetch('/api/health', { headers: { accept: 'application/json' } });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error();
    return (await res.json()) as LiveStatus;
  } catch {
    // Static hosting (no API) → demo mode
    return { live: false, provider: null, model: null, accessTokenRequired: false };
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-token': getAccessToken() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const rules = new RulesExtractor();
const scripted = new ScriptedProvider();

export async function extractDocument(doc: CaseDocument, mode: Mode): Promise<ExtractorRun> {
  if (mode === 'live') {
    return post<ExtractorRun>('/api/extract', {
      document: { name: doc.name, mimeType: doc.mimeType, text: doc.text, base64: doc.text ? undefined : doc.base64 },
    });
  }
  return rules.extract(doc);
}

export async function askAssistant(caseFile: CaseFile, history: ChatTurn[], message: string, mode: Mode): Promise<AgentResult> {
  if (mode === 'live') {
    const slim: CaseFile = { ...caseFile, documents: caseFile.documents.map(({ base64: _b, ...d }) => d) };
    return post<AgentResult>('/api/chat', { caseFile: slim, history, message });
  }
  // Small delay so the trace UI is legible; the work itself is instant
  await new Promise((r) => setTimeout(r, 350));
  return runAgent(scripted, caseFile, history, message);
}

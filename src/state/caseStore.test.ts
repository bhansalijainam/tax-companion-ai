import { describe, expect, it } from 'vitest';
import { emptyCase } from '../ai/pipeline';
import { ApiCaseStore, LocalCaseStore } from './caseStore';

type Call = { url: string; init?: RequestInit };

/** Minimal fake server: replies from a queue and records requests. */
function fakeFetch(replies: { status: number; body: unknown }[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift();
    if (!r) throw new TypeError('network down');
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('ApiCaseStore', () => {
  it('loads a case and sends the loaded version with the next save', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { data: emptyCase(), version: 4, status: 'draft', role: 'preparer' } },
      { status: 200, body: { version: 5 } },
      { status: 200, body: { version: 6 } },
    ]);
    const store = new ApiCaseStore('c1', impl);
    const loaded = await store.load();
    expect(loaded.role).toBe('preparer');
    expect(await store.save(emptyCase())).toEqual({ ok: true });
    expect(JSON.parse(String(calls[1].init?.body)).version).toBe(4);
    await store.save(emptyCase());
    expect(JSON.parse(String(calls[2].init?.body)).version).toBe(5);
  });

  it('reports a conflict instead of overwriting', async () => {
    const { impl } = fakeFetch([
      { status: 200, body: { data: emptyCase(), version: 1 } },
      { status: 409, body: { code: 'conflict', error: 'This case was changed by someone else.' } },
    ]);
    const store = new ApiCaseStore('c1', impl);
    await store.load();
    const r = await store.save(emptyCase());
    expect(r).toMatchObject({ ok: false, reason: 'conflict' });
  });

  it('reports a final (locked) case', async () => {
    const { impl } = fakeFetch([
      { status: 200, body: { data: emptyCase(), version: 1, status: 'final' } },
      { status: 409, body: { code: 'locked', error: 'This case is final.' } },
    ]);
    const store = new ApiCaseStore('c1', impl);
    await store.load();
    expect(await store.save(emptyCase())).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('keeps going when the network is down', async () => {
    const { impl } = fakeFetch([{ status: 200, body: { data: emptyCase(), version: 1 } }]);
    const store = new ApiCaseStore('c1', impl);
    await store.load();
    expect(await store.save(emptyCase())).toMatchObject({ ok: false, reason: 'error' });
  });

  it('never sends binary document payloads', async () => {
    const { impl, calls } = fakeFetch([
      { status: 200, body: { data: emptyCase(), version: 1 } },
      { status: 200, body: { version: 2 } },
    ]);
    const store = new ApiCaseStore('c1', impl);
    await store.load();
    const c = emptyCase();
    c.documents.push({ id: 'd', name: 'x.pdf', kind: 'other', mimeType: 'application/pdf', size: 3, base64: 'AAAA', status: 'queued' });
    await store.save(c);
    expect(String(calls[1].init?.body)).not.toContain('AAAA');
  });
});

describe('LocalCaseStore', () => {
  it('starts on the sample case and round-trips through browser storage', async () => {
    localStorage.clear();
    const store = new LocalCaseStore();
    expect(store.initial().documents.length).toBeGreaterThan(0);
    const c = emptyCase();
    await store.save(c);
    expect(store.initial().documents).toEqual([]);
  });
});

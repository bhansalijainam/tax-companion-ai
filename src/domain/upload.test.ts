import { describe, expect, it } from 'vitest';
import { contentMatchesType, normaliseMime, safeFileName, uploadRequestView } from './upload';
import { buildPracticeCase, PRACTICE_PERSONAS } from '../fixtures/samplePractice';
import { reminderMessage, evaluateChecklist } from './checklist';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0x20)]);

describe('accepted files', () => {
  it('accepts known types, and falls back to the extension only for blank/generic types', () => {
    expect(normaliseMime('application/pdf', 'x.pdf')).toBe('application/pdf');
    expect(normaliseMime('', 'scan.JPG')).toBe('image/jpeg');
    expect(normaliseMime('application/octet-stream', 'f16.pdf')).toBe('application/pdf');
    expect(normaliseMime('application/x-msdownload', 'f16.pdf')).toBeNull();
    expect(normaliseMime('image/heic', 'photo.heic')).toBeNull();
  });

  it('checks magic bytes against the declared type', () => {
    expect(contentMatchesType(bytes(0x25, 0x50, 0x44, 0x46), 'application/pdf')).toBe(true);
    expect(contentMatchesType(bytes(0x4d, 0x5a), 'application/pdf')).toBe(false); // MZ executable
    expect(contentMatchesType(bytes(0xff, 0xd8, 0xff), 'image/jpeg')).toBe(true);
    expect(contentMatchesType(bytes(0x89, 0x50, 0x4e, 0x47), 'image/png')).toBe(true);
    expect(contentMatchesType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp')).toBe(true);
    expect(contentMatchesType(new TextEncoder().encode('Form 16'), 'text/plain')).toBe(true);
    expect(contentMatchesType(new Uint8Array([0x41, 0x00, 0x42]), 'text/plain')).toBe(false);
  });

  it('cleans file names', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeFileName('<img src=x onerror=1>.pdf')).toBe('img src=x onerror=1.pdf');
    expect(safeFileName('\u0000\u0007')).toBe('document');
    expect(safeFileName('a'.repeat(500) + '.pdf').length).toBe(200);
  });
});

describe('the client page view', () => {
  it('lists what the checklist needs and nothing private', () => {
    const c = buildPracticeCase(PRACTICE_PERSONAS.find((p) => p.id === 'c04')!);
    const v = uploadRequestView(c, { firmName: 'Mehta & Rao', expiresAt: '2026-12-12T00:00:00Z', closed: false });
    expect(v.clientFirstName).toBe('Fatima');
    expect(v.items.filter((i) => i.status === 'missing').map((i) => i.kind)).toEqual(['rent-receipt', 'insurance', 'bank-statement']);
    const raw = JSON.stringify(v);
    expect(raw).not.toContain(c.client.pan);
    expect(raw).not.toMatch(/\d{2},\d{3}/); // no rupee amounts
    expect(v.uploaded).toEqual([]); // documents the CA added are not listed
  });
});

describe('reminders with an upload link', () => {
  it('puts the link in place of "reply here"', () => {
    const c = buildPracticeCase(PRACTICE_PERSONAS.find((p) => p.id === 'c04')!);
    const text = reminderMessage({ clientName: 'Fatima Khan', fy: '2024-25', items: evaluateChecklist(c).items, uploadUrl: 'https://x.test/u/abc' });
    expect(text).toContain('https://x.test/u/abc');
    expect(text).not.toContain('reply here');
  });
});

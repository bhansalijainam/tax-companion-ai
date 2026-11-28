import { describe, expect, it } from 'vitest';
import { applyStatus, EMPTY_PROFILE, evaluateChecklist, inferProfile, reminderMessage, requirements, summarizeChecklist, whatsappLink } from './checklist';
import { buildPracticeCase, nextSampleDoc, PRACTICE_PERSONAS } from '../fixtures/samplePractice';
import { buildSampleCase } from '../ai/pipeline';
import type { CaseFile, ClientProfile } from './types';

const profile = (p: Partial<ClientProfile>): ClientProfile => ({ ...EMPTY_PROFILE, ...p });
const persona = (id: string) => PRACTICE_PERSONAS.find((p) => p.id === id)!;
const empty = (p: ClientProfile): CaseFile => ({ client: { name: 'Test Client', pan: '', fy: '2024-25', ay: '2025-26' }, profile: p, documents: [], facts: [], modelFlags: [], flagState: {}, audit: [] });

describe('requirements', () => {
  it('always asks for bank statements and AIS', () => {
    expect(requirements(EMPTY_PROFILE).map((r) => r.kind)).toEqual(['bank-statement', 'ais']);
  });

  it('asks for one Form 16 per employer', () => {
    const r = requirements(profile({ salaried: true, employers: 3 })).find((x) => x.kind === 'form16')!;
    expect(r.minCount).toBe(3);
  });

  it('merges home and education loans into one item needing two certificates', () => {
    const loans = requirements(profile({ homeLoan: true, educationLoan: true })).filter((x) => x.kind === 'loan-certificate');
    expect(loans).toHaveLength(1);
    expect(loans[0].minCount).toBe(2);
  });

  it('treats property documents for rental income as optional', () => {
    expect(requirements(profile({ rentalIncome: true })).find((x) => x.kind === 'property-docs')?.optional).toBe(true);
  });
});

describe('evaluateChecklist', () => {
  it('a new client with nothing received is not started, at 0%', () => {
    const ch = evaluateChecklist(empty(profile({ salaried: true, employers: 1 })));
    expect(ch.stage).toBe('not-started');
    expect(ch.readyPct).toBe(0);
    expect(ch.items.every((i) => i.status === 'missing')).toBe(true);
  });

  it('counts partial receipt: 1 of 2 Form 16s is still missing', () => {
    const ch = evaluateChecklist(buildPracticeCase(persona('c08')));
    const f16 = ch.items.find((i) => i.kind === 'form16')!;
    expect(f16.status).toBe('missing');
    expect(f16.note).toBe('1 of 2 received');
    expect(ch.stage).toBe('awaiting-docs');
    expect(ch.nextAction).toContain('Form 16 (1 of 2)');
  });

  it('all documents in but figures unreviewed means needs review, not ready', () => {
    const ch = evaluateChecklist(buildPracticeCase(persona('c10')));
    expect(ch.items.every((i) => i.status === 'ok')).toBe(true);
    expect(ch.stage).toBe('needs-review');
    expect(ch.readyPct).toBeLessThan(100);
  });

  it('reviewed with nothing open is ready at 100%', () => {
    const ch = evaluateChecklist(buildPracticeCase(persona('c02')));
    expect(ch.stage).toBe('ready');
    expect(ch.readyPct).toBe(100);
  });

  it('a final case is filed regardless of documents', () => {
    expect(evaluateChecklist(empty(EMPTY_PROFILE), 'final').stage).toBe('filed');
  });

  it('marks a document with a high-priority flag as an issue', () => {
    // The sample pack has an AIS deposit-interest mismatch and a cash deposit, both high priority
    const ch = evaluateChecklist(buildPracticeCase(persona('c01')));
    expect(ch.openHighFlags).toBeGreaterThan(0);
    expect(ch.items.some((i) => i.status === 'issue')).toBe(true);
  });

  it('a document that failed to read is an issue', () => {
    const c = empty(profile({}));
    c.documents.push({ id: 'd1', name: 'blurry.jpg', kind: 'ais', mimeType: 'image/jpeg', size: 1, status: 'error', error: 'unreadable' });
    expect(evaluateChecklist(c).items.find((i) => i.kind === 'ais')?.status).toBe('issue');
  });

  it('a simulated client upload moves a missing item forward', () => {
    const p = persona('c03');
    const c = buildPracticeCase(p);
    const doc = nextSampleDoc(p, c, 'capital-gains');
    c.documents.push({ id: doc.id, name: doc.name, kind: doc.kind, mimeType: 'text/plain', size: doc.text.length, text: doc.text, status: 'extracted' });
    expect(evaluateChecklist(c).items.find((i) => i.kind === 'capital-gains')?.status).toBe('ok');
  });

  it('every demo client lands on the stage the demo script expects', () => {
    const stages = Object.fromEntries(PRACTICE_PERSONAS.map((p) => [p.id, evaluateChecklist(buildPracticeCase(p), p.final ? 'final' : 'draft').stage]));
    expect(stages).toEqual({
      c01: 'awaiting-docs', c02: 'ready', c03: 'awaiting-docs', c04: 'awaiting-docs', c05: 'awaiting-docs',
      c06: 'filed', c07: 'awaiting-docs', c08: 'awaiting-docs', c09: 'not-started', c10: 'needs-review',
    });
  });
});

describe('inferProfile (cases saved before profiles existed)', () => {
  it('reads the profile off the sample pack', () => {
    const c = buildSampleCase();
    const p = inferProfile(c);
    expect(p).toMatchObject({ salaried: true, employers: 1, capitalGains: true, homeLoan: true, rentalIncome: true, investments80C: true, healthInsurance: true });
    expect(evaluateChecklist(c).profileInferred).toBe(true);
  });
});

describe('summaries', () => {
  it('carry labels and counts but no document ids', () => {
    const s = summarizeChecklist(evaluateChecklist(buildPracticeCase(persona('c03'))));
    expect(JSON.stringify(s)).not.toContain('docIds');
  });

  it('status overrides a stored summary', () => {
    const s = summarizeChecklist(evaluateChecklist(buildPracticeCase(persona('c10'))));
    expect(applyStatus(s, 'final').stage).toBe('filed');
    const filed = applyStatus(s, 'final');
    expect(applyStatus(filed, 'in_review').stage).toBe('needs-review');
  });
});

describe('reminders', () => {
  it('names only what is missing, with the reason and first name', () => {
    const ch = evaluateChecklist(buildPracticeCase(persona('c04')));
    const text = reminderMessage({ clientName: 'Fatima Khan', fy: '2024-25', items: ch.items, firmName: 'Mehta & Rao' });
    expect(text).toMatch(/^Hi Fatima,/);
    expect(text).toContain('Rent receipts');
    expect(text).toContain('Health-insurance premium receipts');
    expect(text).not.toContain('Form 16'); // already received
    expect(text).toContain('— Mehta & Rao');
  });

  it('says thanks instead when nothing is missing', () => {
    const ch = evaluateChecklist(buildPracticeCase(persona('c02')));
    expect(reminderMessage({ clientName: 'Ananya Iyer', fy: '2024-25', items: ch.items })).toContain('we have everything we need');
  });

  it('builds wa.me links, adding +91 to ten-digit numbers', () => {
    expect(whatsappLink('98765 43210', 'Hi')).toBe('https://wa.me/919876543210?text=Hi');
    expect(whatsappLink('+44 7700 900123', 'a b')).toBe('https://wa.me/447700900123?text=a%20b');
    expect(whatsappLink('09876543210', 'x')).toBe('https://wa.me/919876543210?text=x');
    expect(whatsappLink(undefined, 'x')).toBe('https://wa.me/?text=x');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { demoPractice, DemoClientCaseStore } from './practiceStore';

describe('demo client uploads', () => {
  beforeEach(async () => {
    localStorage.clear();
    demoPractice.reset();
    await new DemoClientCaseStore('c04').uploadLinks.create();
  });

  it('reads a text file and lists it for the client', () => {
    const v = demoPractice.clientUpload('c04', { name: 'rent.txt', mime: 'text/plain', size: 30, text: 'RENT RECEIPT\nRent paid for the year: Rs. 2,16,000', kind: 'rent-receipt' })!;
    expect(v.items.find((i) => i.kind === 'rent-receipt')?.status).toBe('ok');
    expect(v.uploaded.map((u) => u.name)).toEqual(['rent.txt']);
  });

  it('refuses PDFs and photos instead of claiming to have received content it drops', () => {
    expect(() => demoPractice.clientUpload('c04', { name: 'f16.pdf', mime: 'application/pdf', size: 1000 })).toThrow(/only keeps text/);
    expect(demoPractice.getCase('c04')!.documents.some((d) => d.name === 'f16.pdf')).toBe(false);
  });

  it('refuses uploads once the case is filed, but still shows the closed page', () => {
    demoPractice.setStatus('c04', 'final');
    expect(demoPractice.uploadView('c04')?.closed).toBe(true);
    expect(() => demoPractice.clientUploadSample('c04', 'insurance')).toThrow(/already been filed/);
  });

  it('gives each upload its own id, even back to back', () => {
    demoPractice.clientUploadSample('c04', 'insurance');
    demoPractice.clientUploadSample('c04', 'bank-statement');
    const ids = demoPractice.getCase('c04')!.documents.filter((d) => d.source === 'client').map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2);
  });

  it('a turned-off link closes the page', async () => {
    await new DemoClientCaseStore('c04').uploadLinks.revokeAll();
    expect(demoPractice.uploadView('c04')).toBeNull();
  });
});

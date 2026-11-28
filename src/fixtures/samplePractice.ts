/**
 * A fictional ten-client practice for the public demo dashboard. Names, PANs and
 * amounts are invented. Each client is at a different point in the season, so the
 * dashboard shows every stage. Documents are generated from templates the rules
 * extractor can read, so extraction, flags and tax all run for real in the browser.
 */
import { applyExtraction } from '../ai/pipeline.js';
import { rulesExtract } from '../ai/extraction/rulesExtractor.js';
import type { ExtractorRun } from '../ai/extraction/llmExtractor.js';
import type { CaseDocument, CaseFile, ClientProfile, DocKind } from '../domain/types.js';
import { requirements } from '../domain/checklist.js';
import { deriveFlags } from '../domain/caseFile.js';
import { SAMPLE_CLIENT, SAMPLE_DOCUMENTS, type SampleDocument } from './sampleDocuments.js';

export interface Persona {
  id: string;
  name: string;
  pan: string;
  employers: string[];
  profile: ClientProfile;
  /** Rupee figures the templates draw on */
  n: {
    gross: number[]; basic: number[]; hra: number[]; tds: number[];
    rent?: number; landlordPan?: string; savingsInterest: number; lic?: number; ppf?: number; health?: number;
    loanInterest?: number; loanPrincipal?: number; stcg?: number; ltcg?: number; rentReceived?: number; municipalTax?: number;
    receipts?: number; netProfit?: number;
  };
  /** Document kinds already received (repeat a kind for more than one) */
  received: DocKind[];
  /** Mark extracted figures as reviewed */
  reviewed?: boolean;
  final?: boolean;
}

const P = (over: Partial<ClientProfile>): ClientProfile => ({
  salaried: false, employers: 0, paysRent: false, homeLoan: false, educationLoan: false, rentalIncome: false,
  capitalGains: false, business: false, investments80C: false, healthInsurance: false, ...over,
});
const rs = (n: number) => 'Rs. ' + n.toLocaleString('en-IN');

export const PRACTICE_PERSONAS: Persona[] = [
  {
    id: 'c01', name: SAMPLE_CLIENT.name, pan: SAMPLE_CLIENT.pan, employers: [SAMPLE_CLIENT.employer],
    profile: P({ salaried: true, employers: 1, paysRent: true, homeLoan: true, rentalIncome: true, capitalGains: true, investments80C: true, healthInsurance: true }),
    n: { gross: [], basic: [], hra: [], tds: [], savingsInterest: 0 },
    received: [], // uses the full original sample pack
  },
  {
    id: 'c02', name: 'Ananya Iyer', pan: 'BQRPI4821K', employers: ['Kestrel Software Pvt Ltd'],
    profile: P({ salaried: true, employers: 1 }),
    n: { gross: [1_120_000], basic: [480_000], hra: [192_000], tds: [62_400], savingsInterest: 9_850 },
    received: ['form16', 'bank-statement', 'ais'], reviewed: true,
  },
  {
    id: 'c03', name: 'Vikram Mehta', pan: 'AKLPM7310D', employers: ['Orion Pharma Ltd'],
    profile: P({ salaried: true, employers: 1, capitalGains: true, investments80C: true }),
    n: { gross: [2_450_000], basic: [1_000_000], hra: [400_000], tds: [418_000], savingsInterest: 22_400, ppf: 150_000, stcg: 64_000, ltcg: 210_000 },
    received: ['form16', 'bank-statement', 'ais', 'investment-proof'],
  },
  {
    id: 'c04', name: 'Fatima Khan', pan: 'CXZPK1934L', employers: ['Bluewave Logistics LLP'],
    profile: P({ salaried: true, employers: 1, paysRent: true, healthInsurance: true }),
    n: { gross: [960_000], basic: [400_000], hra: [160_000], tds: [31_200], rent: 216_000, landlordPan: 'AFHPR2214Q', savingsInterest: 6_100, health: 18_400 },
    received: ['form16', 'ais'],
  },
  {
    id: 'c05', name: 'Arjun Reddy', pan: 'DGHPR5521M', employers: [],
    profile: P({ business: true, healthInsurance: true }),
    n: { gross: [], basic: [], hra: [], tds: [], savingsInterest: 14_300, receipts: 3_200_000, netProfit: 1_840_000, health: 25_000 },
    received: ['bank-statement', 'ais', 'insurance'],
  },
  {
    id: 'c06', name: 'Priya Desai', pan: 'EKMPD8842N', employers: ['Sapphire Retail Ltd'],
    profile: P({ salaried: true, employers: 1, homeLoan: true, investments80C: true }),
    n: { gross: [1_680_000], basic: [700_000], hra: [280_000], tds: [168_000], savingsInterest: 12_750, lic: 60_000, loanInterest: 195_000, loanPrincipal: 90_000 },
    received: ['form16', 'bank-statement', 'ais', 'investment-proof', 'loan-certificate'], reviewed: true, final: true,
  },
  {
    id: 'c07', name: 'Sanjay Gupta', pan: 'FLNPG3376P', employers: [],
    profile: P({ rentalIncome: true, healthInsurance: true }),
    n: { gross: [], basic: [], hra: [], tds: [], savingsInterest: 48_200, rentReceived: 420_000, municipalTax: 18_000, health: 42_000 },
    received: ['bank-statement', 'insurance', 'property-docs'],
  },
  {
    id: 'c08', name: 'Neha Kapoor', pan: 'GMQPK6650R', employers: ['Lumen Media Pvt Ltd', 'Northstar Consulting LLP'],
    profile: P({ salaried: true, employers: 2 }),
    n: { gross: [720_000, 840_000], basic: [300_000, 350_000], hra: [120_000, 140_000], tds: [24_000, 61_000], savingsInterest: 8_400 },
    received: ['form16', 'bank-statement', 'ais'],
  },
  {
    id: 'c09', name: 'Rohan Joshi', pan: 'HNRPJ9015S', employers: ['Tidewater Infra Ltd'],
    profile: P({ salaried: true, employers: 1, investments80C: true }),
    n: { gross: [1_350_000], basic: [560_000], hra: [224_000], tds: [98_000], savingsInterest: 11_200, ppf: 100_000 },
    received: [],
  },
  {
    id: 'c10', name: 'Kavita Nair', pan: 'JPSPN2287T', employers: ['Cobalt Analytics Pvt Ltd'],
    profile: P({ salaried: true, employers: 1, investments80C: true, healthInsurance: true }),
    n: { gross: [1_890_000], basic: [780_000], hra: [312_000], tds: [214_500], savingsInterest: 17_900, lic: 45_000, ppf: 60_000, health: 26_500 },
    received: ['form16', 'bank-statement', 'ais', 'investment-proof', 'insurance'],
  },
];

const FY = '2024-25';

/** Template text for one document of `kind`. `i` picks the employer for Form 16s. */
export function sampleDocText(p: Persona, kind: DocKind, i = 0): { name: string; text: string } {
  const n = p.n;
  const tdsTotal = n.tds.reduce((a, b) => a + b, 0);
  const first = p.name.split(' ')[0];
  switch (kind) {
    case 'form16': {
      const emp = p.employers[i] ?? p.employers[0] ?? 'Employer';
      const k = Math.min(i, n.gross.length - 1);
      return {
        name: `Form16_${emp.split(' ')[0]}_FY${FY}.pdf`,
        text: [
          'FORM NO. 16 — PART B (Annexure)',
          `Name of Employer: ${emp}`,
          `Name of Employee: ${p.name}     PAN of Employee: ${p.pan}`,
          'Assessment Year: 2025-26',
          `   (a) Salary as per provisions contained in section 17(1): ${rs(n.gross[k])}`,
          `       of which Basic Salary: ${rs(n.basic[k])}`,
          `       of which House Rent Allowance: ${rs(n.hra[k])}`,
          `   (c) Tax on employment u/s 16(iii): ${rs(2_500)}`,
          `       Employee Provident Fund: ${rs(Math.round(n.basic[k] * 0.12))}`,
          ...(n.rent && i === 0 ? [`Rent declared by employee: ${rs(n.rent)} (Landlord PAN: ${n.landlordPan ?? 'not provided'})`] : []),
          `Total amount of tax deducted at source (TDS) u/s 192: ${rs(n.tds[k])}`,
        ].join('\n'),
      };
    }
    case 'bank-statement':
      return {
        name: `Savings_Statement_FY${FY}.pdf`,
        text: [
          `Statement of Account — ${p.name.toUpperCase()} (Savings)`,
          'Period: 01/04/2024 to 31/03/2025',
          `Total savings interest credited: ${rs(n.savingsInterest)}`,
          ...(n.rentReceived ? [`Rent received from tenant (12 months): Total ${rs(n.rentReceived)}`, `Property tax paid to municipal corporation: ${rs(n.municipalTax ?? 0)}`] : []),
          ...(n.receipts ? [`Professional fees received (client transfers): ${rs(n.receipts)}`] : []),
        ].join('\n'),
      };
    case 'ais':
      return {
        name: `AIS_FY${FY}.pdf`,
        text: [
          `ANNUAL INFORMATION STATEMENT (AIS) — PAN ${p.pan} — FY ${FY}`,
          'Part B1: TDS/TCS information',
          ...p.employers.map((e, k) => `  TDS - Salary (s.192) - ${e}: ${n.tds[k]?.toLocaleString('en-IN')}`),
          `  Total TDS reported: ${tdsTotal.toLocaleString('en-IN')}`,
          'Part B2: SFT information',
          `  SFT-005 Interest income - Savings account: ${n.savingsInterest.toLocaleString('en-IN')}`,
        ].join('\n'),
      };
    case 'investment-proof':
      return n.lic
        ? { name: 'LIC_Premium_Certificate.pdf', text: `LIFE INSURANCE CORPORATION OF INDIA — Premium Paid Certificate\nLife Assured: ${p.name}\nPremium paid during 01-04-2024 to 31-03-2025: ${rs(n.lic)}` + (n.ppf ? `\nPublic Provident Fund — Holder: ${p.name}\nTotal deposits in FY 2024-25: ${rs(n.ppf)}` : '') }
        : { name: 'PPF_Passbook.pdf', text: `Public Provident Fund Account — Holder: ${p.name}\nTotal deposits in FY 2024-25: ${rs(n.ppf ?? 50_000)}` };
    case 'insurance':
      return { name: 'Health_Insurance_80D.pdf', text: `Health insurance premium certificate u/s 80D\nInsured: ${p.name} (self) and family\nPremium paid (incl. GST) for FY 2024-25: ${rs(n.health ?? 20_000)}` };
    case 'loan-certificate':
      return {
        name: 'HomeLoan_Interest_Certificate.pdf',
        text: `Provisional Interest Certificate (FY ${FY}) — home loan\nBorrower: ${p.name}\nProperty status: Self-occupied\nPrincipal repaid during the year: ${rs(n.loanPrincipal ?? 0)}\nInterest paid during the year: ${rs(n.loanInterest ?? 0)}`,
      };
    case 'capital-gains':
      return { name: `Broker_Tax_PnL_FY${FY}.pdf`, text: `Tax P&L Statement — Client: ${p.name} — FY ${FY}\nShort Term Capital Gain (s.111A): ${rs(n.stcg ?? 0)}\nLong Term Capital Gain (s.112A), before exemption: ${rs(n.ltcg ?? 0)}` };
    case 'rent-receipt':
      return { name: 'Rent_Receipts_FY2024-25.pdf', text: `RENT RECEIPT — consolidated for FY ${FY}\nReceived from ${p.name}\nRent paid for the year: ${rs(n.rent ?? 0)}\nLandlord PAN: ${n.landlordPan ?? 'not provided'}` };
    case 'business-financials':
      return { name: `Profit_and_Loss_FY${FY}.pdf`, text: `PROFIT AND LOSS ACCOUNT for FY ${FY} — ${p.name} (Proprietor)\nGross receipts from profession: ${rs(n.receipts ?? 0)}\nNet profit: ${rs(n.netProfit ?? 0)}` };
    case 'property-docs':
      return { name: 'Rent_Agreement_and_Tax_Receipt.pdf', text: `RENT AGREEMENT (leave and licence) — Licensor: ${p.name}\nMonthly licence fee: ${rs(Math.round((n.rentReceived ?? 0) / 12))}\nProperty tax receipt FY ${FY}: ${rs(n.municipalTax ?? 0)}` };
    default:
      return { name: `${first}_document.txt`, text: `Document for ${p.name}` };
  }
}

function extracted(c: CaseFile, d: SampleDocument) {
  const base: CaseDocument = { id: d.id, name: d.name, kind: d.kind, mimeType: 'text/plain', size: d.text.length, text: d.text, status: 'queued' };
  const run: ExtractorRun = { output: rulesExtract(base, d.kind), extractor: 'rules:v1', latencyMs: 0 };
  const applied = applyExtraction(base, run);
  c.documents.push({ ...base, ...applied.doc } as CaseDocument);
  c.facts.push(...applied.facts);
  c.modelFlags.push(...applied.flags);
}

/** The next document of this kind a persona would send (used by "simulate client upload"). */
export function nextSampleDoc(p: Persona, c: CaseFile, kind: DocKind): SampleDocument {
  if (p.id === 'c01') {
    const original = SAMPLE_DOCUMENTS.find((d) => d.kind === kind && !c.documents.some((x) => x.id === d.id));
    if (original) return original;
  }
  const i = c.documents.filter((d) => d.kind === kind).length;
  const { name, text } = sampleDocText(p, kind, i);
  return { id: `doc-${kind}-${i}-${Date.now().toString(36)}`, name, kind, text };
}

export function buildPracticeCase(p: Persona): CaseFile {
  const c: CaseFile = {
    client: { name: p.name, pan: p.pan, fy: FY, ay: '2025-26', employer: p.employers[0] },
    profile: { ...p.profile },
    documents: [], facts: [], modelFlags: [], flagState: {}, audit: [],
  };
  const docs: SampleDocument[] = p.id === 'c01'
    ? SAMPLE_DOCUMENTS
    : p.received.map((kind, idx) => {
        const i = p.received.slice(0, idx).filter((k) => k === kind).length;
        return { id: `doc-${kind}-${i}`, kind, ...sampleDocText(p, kind, i) };
      });
  for (const d of docs) extracted(c, d);
  if (p.reviewed) {
    c.facts = c.facts.map((f) => ({ ...f, status: 'accepted' }));
    for (const f of deriveFlags(c)) c.flagState[f.id] = { status: 'resolved', note: 'Checked with client', at: new Date().toISOString() };
  }
  c.audit.push({ at: new Date().toISOString(), actor: 'system', action: 'case.created', detail: `Demo client: ${docs.length} of ${requirements(p.profile).filter((r) => !r.optional).length}+ documents received` });
  return c;
}

/** Stand-in figures for a client the CA added during the demo, so "simulate upload" still works. */
export function genericPersona(c: CaseFile): Persona {
  const p = c.profile ?? PRACTICE_PERSONAS[1].profile;
  const employers = Math.max(1, p.employers);
  return {
    id: 'generic', name: c.client.name || 'Client', pan: c.client.pan || 'ABCDE1234F',
    employers: Array.from({ length: employers }, (_, i) => (i === 0 ? 'Acme Industries Ltd' : `Employer ${i + 1} Pvt Ltd`)),
    profile: p,
    n: {
      gross: Array(employers).fill(1_200_000), basic: Array(employers).fill(500_000), hra: Array(employers).fill(200_000), tds: Array(employers).fill(85_000),
      rent: 240_000, landlordPan: 'AFHPR2214Q', savingsInterest: 12_000, lic: 40_000, ppf: 60_000, health: 22_000,
      loanInterest: 180_000, loanPrincipal: 80_000, stcg: 30_000, ltcg: 140_000, rentReceived: 300_000, municipalTax: 12_000,
      receipts: 2_000_000, netProfit: 1_100_000,
    },
    received: [],
  };
}

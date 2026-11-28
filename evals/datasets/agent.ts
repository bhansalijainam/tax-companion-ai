/**
 * Agent eval set, run against the demo case. Expected figures come from the
 * deterministic engine at eval time, so the eval checks that the agent reports the
 * engine's numbers rather than a hard-coded copy that could drift.
 */
import { caseSummary } from '../../src/domain/caseFile.js';
import { executeTool } from '../../src/ai/agent/tools.js';
import type { CaseFile } from '../../src/domain/types.js';

export interface AgentCase {
  id: string;
  question: string;
  /** At least one of these tools must be called */
  expectTools: string[];
  /** Figures/words the answer must contain (computed from the case) */
  mustMention: (c: CaseFile) => string[];
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const AGENT_CASES: AgentCase[] = [
  {
    id: 'regime-choice',
    question: 'Which regime should the client choose, and by how much does it win?',
    expectTools: ['compute_tax', 'get_case_overview'],
    mustMention: (c) => {
      const s = caseSummary(c).comparison;
      return [s.recommended, inr(s.savings)];
    },
  },
  {
    id: 'nps-what-if',
    question: 'What if the client invests 50000 more in NPS under 80CCD(1B)? Show old regime tax before and after.',
    expectTools: ['compute_tax'],
    mustMention: (c) => {
      const alt = executeTool('compute_tax', { regime: 'old', overrides: [{ field: 'deductions.sec80CCD1B', amount: 50_000, mode: 'add' }] }, c) as { old: { totalTax: number } };
      return [inr(caseSummary(c).comparison.old.totalTax), inr(alt.old.totalTax)];
    },
  },
  {
    id: 'open-flags',
    question: 'What open issues should I raise with the client before filing?',
    expectTools: ['get_flags'],
    mustMention: () => ['PAN', 'AIS'],
  },
  {
    id: 'headroom',
    question: 'How much deduction headroom is left for this client?',
    expectTools: ['deduction_headroom'],
    mustMention: () => ['80CCD(1B)', '₹50,000'],
  },
  {
    id: 'source-citation',
    question: 'Where does the rent paid figure come from?',
    expectTools: ['search_documents', 'get_facts'],
    mustMention: () => ['3,60,000'],
  },
  {
    id: 'refund',
    question: 'Is there tax payable or a refund under the recommended regime?',
    expectTools: ['compute_tax', 'get_case_overview'],
    mustMention: (c) => {
      const s = caseSummary(c).comparison;
      return [inr(Math.abs(s[s.recommended].netPayable))];
    },
  },
];

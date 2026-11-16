export type Section = 'dashboard' | 'documents' | 'review' | 'flags' | 'tax' | 'chat' | 'report' | 'evals' | 'architecture';

export const MOBILE_NAV: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'review', label: 'Review' },
  { id: 'flags', label: 'Flags' },
  { id: 'tax', label: 'Tax' },
  { id: 'chat', label: 'Assistant' },
  { id: 'report', label: 'Report' },
  { id: 'evals', label: 'Evals' },
  { id: 'architecture', label: 'How it works' },
];

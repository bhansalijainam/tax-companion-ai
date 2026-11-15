export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'text-success';
  if (confidence >= 0.75) return 'text-warning';
  return 'text-destructive';
};

export const getSectionBadgeClass = (section: string): string => {
  const sectionLower = section.toLowerCase();
  if (sectionLower.includes('80c')) return 'section-80c';
  if (sectionLower.includes('80d')) return 'section-80d';
  if (sectionLower.includes('80g')) return 'section-80g';
  if (sectionLower.includes('section') || sectionLower.includes('deductible')) return 'section-deductible';
  return 'section-non-deductible';
};

/** ₹ with Indian digit grouping; negative values use a true minus sign. */
export const inr = (n: number): string => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');

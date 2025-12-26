const DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;
const MONTH_ONLY = /^\d{4}-\d{2}$/;

const pad2 = (value: number) => value.toString().padStart(2, '0');

export const toDateOnly = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (DATE_ONLY.test(trimmed)) return trimmed.slice(0, 10);
  if (MONTH_ONLY.test(trimmed)) return `${trimmed}-01`;
  const date = new Date(trimmed);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
};

export const toMonthStart = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (MONTH_ONLY.test(trimmed)) return `${trimmed}-01`;
  if (DATE_ONLY.test(trimmed)) return `${trimmed.slice(0, 7)}-01`;
  const date = new Date(trimmed);
  if (Number.isNaN(date.valueOf())) return null;
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  return `${year}-${month}-01`;
};

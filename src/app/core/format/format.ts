const amount = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Money is always shown as "SLE 1,200.00" (§1, §13). We format the number ourselves instead of
 * relying on `currency: 'SLE'` so the output is identical on browsers with older ICU data.
 */
export function formatSle(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}SLE ${amount.format(Math.abs(value))}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatKg(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${formatNumber(value, 3)} kg`;
}

/** Local date. API sends UTC ISO date-times or YYYY-MM-DD dates. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function relativeTime(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return value;
  const seconds = Math.round((t - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
}

/**
 * Masks a value for display, keeping the last `visible` characters. The API already masks
 * phones and IMEIs (§1); this is a safety net for anything typed locally.
 */
export function maskTail(value: string | null | undefined, visible = 4, char = '•'): string {
  if (!value) return '—';
  if (value.includes('*')) return value; // already masked by the API
  const clean = value.replace(/\s+/g, '');
  if (clean.length <= visible) return clean;
  return char.repeat(clean.length - visible) + clean.slice(-visible);
}

/** Today as YYYY-MM-DD (for date-only API fields). */
export function isoDate(d: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

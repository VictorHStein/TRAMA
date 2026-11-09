/** Number formatting for the UI (pt-BR, tabular digits come from CSS). */
const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const pf = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const fixed = new Map<number, Intl.NumberFormat>();

/** Up to 2 decimals by default; with `digits`, exactly that many. */
export function fmtNum(n: number | null | undefined, digits?: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (digits === undefined) return nf.format(n);
  let f = fixed.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    fixed.set(digits, f);
  }
  return f.format(n);
}

export function fmtPct(f: number | null | undefined): string {
  if (f === null || f === undefined || !Number.isFinite(f)) return '—';
  return pf.format(f);
}

const pf1 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
/** Percent with one decimal below 10 % (0,3 %, 1,3 %, 37 %), for small shares such as mode fractions. */
export function fmtPctFine(f: number | null | undefined): string {
  if (f === null || f === undefined || !Number.isFinite(f)) return '—';
  return Math.abs(f) < 0.1 ? pf1.format(f) : pf.format(f);
}

/** "3,2 kg" — value and unit with a non-breaking space ("97,6°" for bare degrees). */
export function fmtQty(n: number | null | undefined, unit: string, digits?: number): string {
  const v = fmtNum(n, digits);
  if (!unit || unit === '-') return v;
  if (unit === '°') return `${v}°`;
  return `${v}\u00a0${unit}`;
}

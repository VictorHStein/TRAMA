/** localStorage key set once the first-run tour has been finished or skipped. */
export const TOUR_DONE_KEY = 'tg2.tour.done';

/** True on the first visit (no flag yet); false when storage is unavailable, so tests and private windows skip it. */
export function tourPending(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage && !window.localStorage.getItem(TOUR_DONE_KEY);
  } catch {
    return false;
  }
}

export function markTourDone(): void {
  try { window.localStorage.setItem(TOUR_DONE_KEY, '1'); } catch { /* private mode: the tour shows again next time */ }
}

export const SLIDE_SEARCH_PARAM = 'slide';

/** Parses `?slide=N` (1-based) into a 0-based index clamped to the slide deck. Missing or invalid → 0. */
export const parseSlideParam = (raw: string | null, slidesLength: number): number => {
  if (slidesLength <= 0 || raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed - 1, 0), slidesLength - 1);
};

/**
 * Returns the canonical `?slide` value when the current one is invalid or out of range,
 * or `null` when the URL needs no rewrite (already canonical, absent, or slides unknown yet).
 */
export const normalizeSlideParam = (raw: string | null, slidesLength: number): string | null => {
  if (raw === null || slidesLength <= 0) return null;
  const canonical = String(parseSlideParam(raw, slidesLength) + 1);
  return canonical === raw ? null : canonical;
};

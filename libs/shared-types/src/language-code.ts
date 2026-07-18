/**
 * Validates and canonicalizes a BCP-47 language tag (e.g. `es`, `zh-Hans`).
 * Rejects display names, empty values, and punctuation-heavy strings.
 *
 * @returns Canonical tag from `Intl.getCanonicalLocales`, or null if invalid.
 */
export function canonicalizeBcp47LanguageCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Primary language 2–3 letters; optional script/region/variant subtags.
  // Rejects spaces (display names like "Spanish") and most punctuation.
  if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{1,8})*$/.test(trimmed)) {
    return null;
  }

  try {
    const normalized = trimmed.replace(/_/g, '-');
    const [canonical] = Intl.getCanonicalLocales(normalized);
    return typeof canonical === 'string' && canonical.length > 0 ? canonical : null;
  } catch {
    return null;
  }
}

export function isBcp47LanguageCode(value: string): boolean {
  return canonicalizeBcp47LanguageCode(value) !== null;
}

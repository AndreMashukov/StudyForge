import type { Directory } from '@shared-types';

const DIRECTORY_PATH_PREFIX = '/directory/';

/** Lowercase hyphen slug for readable directory URLs. */
export function slugifyDirectoryName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildDirectoryPathFromParts(id: string, name: string): string {
  const slug = slugifyDirectoryName(name);
  const segment = slug ? `${slug}-${id}` : id;
  return `${DIRECTORY_PATH_PREFIX}${segment}`;
}

export function buildDirectoryPath(directory: Pick<Directory, 'id' | 'name'>): string {
  return buildDirectoryPathFromParts(directory.id, directory.name);
}

export function buildDirectoryPathWithTab(
  directory: Pick<Directory, 'id' | 'name'>,
  tab?: string,
): string {
  const base = buildDirectoryPath(directory);
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

/** Build a directory path when the name may be unavailable (falls back to ID-only). */
export function buildDirectoryPathWithOptionalName(
  id: string,
  name?: string,
  tab?: string,
): string {
  const base = name ? buildDirectoryPathFromParts(id, name) : `${DIRECTORY_PATH_PREFIX}${id}`;
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

/**
 * Parse a route param or path segment into a directory ID.
 * Supports canonical `slug-id` URLs and legacy ID-only URLs.
 */
export function extractDirectoryIdFromRouteParam(param: string | undefined): string | null {
  if (!param?.trim()) {
    return null;
  }

  let decoded = param.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw param when decoding fails.
  }

  const lastHyphen = decoded.lastIndexOf('-');
  if (lastHyphen === -1) {
    return decoded;
  }

  const idCandidate = decoded.slice(lastHyphen + 1);
  return idCandidate || decoded;
}

export function extractDirectoryIdFromDirectoryPath(path: string): string | null {
  if (!path.startsWith(DIRECTORY_PATH_PREFIX)) {
    return null;
  }

  const segment = path.slice(DIRECTORY_PATH_PREFIX.length).split('?')[0]?.split('#')[0];
  return extractDirectoryIdFromRouteParam(segment);
}

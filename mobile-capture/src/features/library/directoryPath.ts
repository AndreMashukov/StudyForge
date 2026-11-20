/** Minimal directory shape a breadcrumb needs; the mobile directory schema satisfies it. */
export interface IPathDirectory {
  id: string;
  name: string;
  parentId: string | null;
}

/** Breadcrumb from the library root, e.g. "Biology 201 › Cell Biology". */
export function directoryPath(
  directories: IPathDirectory[],
  directoryId: string | null | undefined,
): string {
  const byId = new Map(
    directories.map((directory) => [directory.id, directory]),
  );
  const names: string[] = [];
  const seen = new Set<string>();
  let current = directoryId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const directory = byId.get(current);
    if (!directory) break;
    names.unshift(directory.name);
    current = directory.parentId;
  }
  return names.join(' › ');
}

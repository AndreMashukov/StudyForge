/**
 * Display order for folders among their siblings. A folder the user placed by
 * drag and drop has a `sortOrder`; those come first, lowest first. Folders
 * without one (new, moved, or never reordered) follow in A–Z order. Shared by
 * the web app, the mobile app and the backend so every view agrees.
 */
export interface IOrderableFolder {
  name: string;
  sortOrder?: number;
}

function hasSortOrder(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Compares two folders by manual position, then by name (case-insensitive). */
export function compareFolderOrder(
  left: IOrderableFolder,
  right: IOrderableFolder,
): number {
  const leftOrdered = hasSortOrder(left.sortOrder);
  const rightOrdered = hasSortOrder(right.sortOrder);
  if (leftOrdered && rightOrdered && left.sortOrder !== right.sortOrder) {
    return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
  }
  if (leftOrdered !== rightOrdered) {
    return leftOrdered ? -1 : 1;
  }
  return left.name.localeCompare(right.name, undefined, {
    sensitivity: 'base',
  });
}

/** Returns a sorted copy of sibling folders in display order. */
export function sortFoldersForDisplay<T extends IOrderableFolder>(
  folders: readonly T[],
): T[] {
  return [...folders].sort(compareFolderOrder);
}

/** True when any of these sibling folders has a manual position. */
export function hasManualFolderOrder(
  folders: readonly IOrderableFolder[],
): boolean {
  return folders.some((folder) => hasSortOrder(folder.sortOrder));
}

/** Saves the order of a parent's folders (null parent = top level). */
export interface ReorderDirectoriesRequest {
  parentId: string | null;
  /** Every folder in the parent, in the new order. */
  orderedDirectoryIds: string[];
}

/** Clears the manual order of a parent's folders, back to A–Z. */
export interface ResetDirectoryOrderRequest {
  parentId: string | null;
}

export interface ReorderDirectoriesResponse {
  success: boolean;
}

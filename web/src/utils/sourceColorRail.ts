import { getDocumentFallbackColor } from '@shared-types';
import type { CSSProperties } from 'react';

/**
 * Returns the inline style object for a solid single-color left rail.
 * Use together with the Tailwind class `border-l-[4px]`.
 */
export function getColorRailStyle(
  documentColor?: string,
  documentId?: string,
): CSSProperties {
  const color = documentColor ?? (documentId ? getDocumentFallbackColor(documentId) : '#8b5cf6');
  return { borderLeftColor: color };
}

/**
 * Returns true when there are multiple distinct source document colors
 * that should render as a segmented rail instead of a solid one.
 */
export function isMultiColor(documentColors?: string[]): boolean {
  return Array.isArray(documentColors) && documentColors.length > 1;
}

/**
 * Renders a segmented color rail as an array of color segments.
 * Each segment is an equally-sized fraction of the total height.
 * Returns an empty array for single-color or missing colors.
 */
export function getSegmentedRailColors(documentColors?: string[]): string[] {
  if (!isMultiColor(documentColors) || !documentColors) return [];
  return documentColors;
}

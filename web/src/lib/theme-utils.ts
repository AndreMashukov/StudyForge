import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Creates a theme-aware className string using direct color values
 * @param colorKey - The color key from theme colors
 * @param property - CSS property to apply (bg, text, border, etc.)
 * @returns Tailwind className string
 */
export function themeColor(colorKey: string, property: 'bg' | 'text' | 'border' | 'ring' = 'bg'): string {
  return `${property}-theme-${colorKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/**
 * Creates conditional theme classes
 * @param condition - Boolean condition
 * @param trueClass - Class to apply when true
 * @param falseClass - Class to apply when false
 * @returns Conditional className string
 */
export function themeConditional(
  condition: boolean,
  trueClass: string,
  falseClass?: string
): string {
  return condition ? trueClass : (falseClass || '');
}

/**
 * Merges theme-aware classes with regular Tailwind classes
 * @param themeClasses - Theme-specific classes
 * @param regularClasses - Regular Tailwind classes
 * @returns Merged className string
 */
export function mergeThemeClasses(themeClasses: string, regularClasses: string): string {
  return cn(themeClasses, regularClasses);
}

/**
 * Creates responsive theme classes
 * @param baseClass - Base theme class
 * @param responsive - Object with breakpoint keys and theme class values
 * @returns Responsive className string
 */
export function responsiveTheme(
  baseClass: string,
  responsive?: Record<string, string>
): string {
  const classes = [baseClass];
  
  if (responsive) {
    Object.entries(responsive).forEach(([breakpoint, themeClass]) => {
      classes.push(`${breakpoint}:${themeClass}`);
    });
  }
  
  return cn(...classes);
}

/**
 * Theme-aware focus and hover states
 * @param baseClass - Base theme class
 * @param hoverClass - Hover state theme class
 * @param focusClass - Focus state theme class
 * @returns Interactive className string
 */
export function interactiveTheme(
  baseClass: string,
  hoverClass?: string,
  focusClass?: string
): string {
  const classes = [baseClass];
  
  if (hoverClass) {
    classes.push(`hover:${hoverClass}`);
  }
  
  if (focusClass) {
    classes.push(`focus:${focusClass}`);
  }
  
  return cn(...classes);
}
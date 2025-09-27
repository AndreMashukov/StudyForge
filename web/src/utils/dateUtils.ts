import { format, isValid, parseISO } from 'date-fns';

/**
 * Utility functions for date formatting and handling using date-fns
 */

/**
 * Converts various date formats to a valid Date object
 * @param date - Date value that can be Date, Firebase Timestamp, raw Firebase Timestamp, string, number, or null/undefined
 * @returns Valid Date object or null
 */
const parseDate = (date: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined): Date | null => {
  try {
    // Handle null/undefined
    if (date === null || date === undefined) {
      return null;
    }

    // Handle Date objects
    if (date instanceof Date) {
      return isValid(date) ? date : null;
    }

    // Handle Firebase Timestamp objects (objects with toDate method)
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      try {
        const convertedDate = date.toDate();
        return isValid(convertedDate) ? convertedDate : null;
      } catch {
        return null;
      }
    }

    // Handle raw Firebase Timestamp objects (with _seconds and _nanoseconds)
    if (typeof date === 'object' && date !== null && '_seconds' in date && '_nanoseconds' in date) {
      try {
        // Convert Firebase Timestamp to JavaScript Date
        // _seconds is Unix timestamp in seconds, _nanoseconds is additional precision
        const timestamp = date as { _seconds: number; _nanoseconds: number };
        const milliseconds = timestamp._seconds * 1000 + Math.floor(timestamp._nanoseconds / 1000000);
        const convertedDate = new Date(milliseconds);
        return isValid(convertedDate) ? convertedDate : null;
      } catch {
        return null;
      }
    }

    // Handle number timestamps (Unix timestamps)
    if (typeof date === 'number') {
      const dateFromNumber = new Date(date);
      return isValid(dateFromNumber) ? dateFromNumber : null;
    }

    // Handle string dates
    if (typeof date === 'string') {
      // Skip empty strings
      if (date.trim() === '') {
        return null;
      }
      
      // Try parsing as ISO string first
      try {
        const isoDate = parseISO(date);
        if (isValid(isoDate)) {
          return isoDate;
        }
      } catch {
        // Fall through to regular Date parsing
      }
      
      // Try regular Date parsing
      const parsedDate = new Date(date);
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Formats a date value that can come from Firebase Firestore in various formats
 * @param date - Date value that can be Date, Firebase Timestamp, raw Firebase Timestamp, string, number, or null/undefined
 * @returns Formatted date string or fallback value
 */
export const formatDate = (date: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined): string => {
  const parsedDate = parseDate(date);
  
  if (!parsedDate) {
    return 'Unknown';
  }

  try {
    return format(parsedDate, 'M/d/yyyy');
  } catch {
    return 'Unknown';
  }
};

/**
 * Formats a date with custom format string using date-fns
 * @param date - Date value that can be Date, Firebase Timestamp, raw Firebase Timestamp, string, number, or null/undefined
 * @param formatString - date-fns format string (default: 'MMM d, yyyy')
 * @returns Formatted date string or fallback value
 */
export const formatDateWithOptions = (
  date: Date | { toDate(): Date } | { _seconds: number; _nanoseconds: number } | string | number | null | undefined,
  formatString = 'MMM d, yyyy'
): string => {
  const parsedDate = parseDate(date);
  
  if (!parsedDate) {
    return 'Invalid date';
  }

  try {
    return format(parsedDate, formatString);
  } catch {
    return 'Invalid date';
  }
};

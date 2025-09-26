export const formatDate = (date: Date | { toDate(): Date } | string): string => {
  try {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString();
    }
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString();
    }
    // Fallback
    return new Date().toLocaleDateString();
  } catch (error) {
    console.warn('Error formatting date:', error, date);
    return 'Invalid date';
  }
};
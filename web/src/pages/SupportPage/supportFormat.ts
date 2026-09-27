import { formatDistanceToNow, parseISO } from 'date-fns';

export function formatSupportWhen(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatSupportCategory(category: string): string {
  switch (category) {
    case 'how_it_works':
      return 'How it works';
    case 'bug':
      return 'Bug';
    case 'billing':
      return 'Billing';
    default:
      return category || 'Support';
  }
}

export function formatMessageAuthor(authorType: string): string {
  switch (authorType) {
    case 'user':
      return 'You';
    case 'staff':
      return 'Staff';
    case 'system':
      return 'System';
    default:
      return authorType || 'Message';
  }
}

export function ticketSortTimestamp(
  updatedAt: string | null | undefined,
  createdAt: string | null | undefined,
): string {
  return updatedAt || createdAt || '';
}

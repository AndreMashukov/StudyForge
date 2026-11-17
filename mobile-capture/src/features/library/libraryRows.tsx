import type { useRouter } from 'expo-router';
import type { DirectoryItemSummary } from '@shared-types';
import { ItemRow } from '../shell/ui';
import { openLibraryItem } from '../assistant/ChatMessageView';
import {
  itemHref,
  itemIcon,
  itemKindLabel,
  type ILibraryItemRef,
} from './itemNavigation';

export function toItemRef(item: DirectoryItemSummary): ILibraryItemRef | null {
  if (item.itemType === 'subdirectory') return null;
  return {
    itemType: item.itemType,
    id: item.sourceId,
    title: item.title,
    directoryId: item.directoryId,
  };
}

export function statusBadge(
  status: DirectoryItemSummary['generationStatus'],
): string | undefined {
  if (status === 'pending') return 'Generating';
  if (status === 'failed') return 'Failed';
  return undefined;
}

export function LibraryItemRow({
  item,
  router,
  subtitle,
}: {
  item: DirectoryItemSummary;
  router: ReturnType<typeof useRouter>;
  subtitle?: string;
}) {
  const ref = toItemRef(item);
  if (!ref) return null;
  const web = !itemHref(ref);
  return (
    <ItemRow
      icon={itemIcon(ref.itemType)}
      title={item.title}
      subtitle={
        subtitle ??
        `${itemKindLabel(ref.itemType)}${web ? ' · opens on the web' : ''}`
      }
      badge={statusBadge(item.generationStatus)}
      onPress={
        item.generationStatus === 'pending' && ref.itemType !== 'document'
          ? undefined
          : () => openLibraryItem(router, ref)
      }
    />
  );
}

import { useMemo } from 'react';
import { Text } from '@studyforge/mobile-ui';
import {
  flattenDirectoryTree,
  useDirectoryTreeQuery,
} from '../directories/api/directoryQueries';
import { DirectoryPicker } from '../shell/DirectoryPicker';
import { Sheet } from '../shell/ui';

export interface IScopeSheet {
  visible: boolean;
  directoryId: string | null;
  onChange: (directoryId: string | null) => void;
  onClose: () => void;
}

/** "Chat about": the whole library (workspace agent) or one directory tree (directory-scoped agent). */
export function ScopeSheet({
  visible,
  directoryId,
  onChange,
  onClose,
}: IScopeSheet) {
  const treeQuery = useDirectoryTreeQuery();
  const directories = useMemo(
    () => flattenDirectoryTree(treeQuery.data?.tree ?? []),
    [treeQuery.data],
  );
  return (
    <Sheet visible={visible} title="Chat about" onClose={onClose}>
      <DirectoryPicker
        directories={directories}
        selectedId={directoryId}
        rootLabel="Whole library"
        onSelectRoot={() => onChange(null)}
        onSelect={(id) => onChange(id)}
      />
      <Text variant="caption" tone="muted" className="mt-3">
        A directory limits the assistant to that directory and everything inside
        it.
      </Text>
    </Sheet>
  );
}

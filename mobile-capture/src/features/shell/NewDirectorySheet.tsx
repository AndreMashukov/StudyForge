import { useState } from 'react';
import { Button, Text, TextInputField } from '@studyforge/mobile-ui';
import { createDirectoryInFirestore } from '@studyforge/client-data/directoryCreate';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthUser } from '../auth/hooks/useAuthUser';
import { queryKeys } from '../../lib/api/queryKeys';
import { getCallableErrorMessage } from '../../lib/api/studyforgeApi';
import { useIsOnline, OFFLINE_MESSAGE } from '../../lib/network/online';
import { Sheet } from './ui';

export interface INewDirectorySheet {
  visible: boolean;
  parentId: string | null;
  parentName?: string;
  onClose: () => void;
  onCreated: (directoryId: string) => void;
}

/** Decision 14: the one library-management action on mobile. Uses the shared client path from client-data. */
export function NewDirectorySheet({
  visible,
  parentId,
  parentName,
  onClose,
  onCreated,
}: INewDirectorySheet) {
  const { user } = useAuthUser();
  const client = useQueryClient();
  const online = useIsOnline();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const directory = await createDirectoryInFirestore(user.uid, {
        name: name.trim(),
        parentId: parentId ?? undefined,
      });
      await client.invalidateQueries({
        queryKey: queryKeys.directoryTree(user.uid),
      });
      setName('');
      onCreated(directory.id);
    } catch (createError) {
      setError(getCallableErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} title="New directory" onClose={onClose}>
      <Text tone="muted" className="mb-3">
        {parentName ? `Inside ${parentName}` : 'At the top of your library'}
      </Text>
      <TextInputField
        value={name}
        onChangeText={setName}
        placeholder="Directory name"
        autoCapitalize="sentences"
      />
      {error ? (
        <Text tone="destructive" className="mb-2">
          {error}
        </Text>
      ) : null}
      {!online ? (
        <Text tone="muted" className="mb-2">
          {OFFLINE_MESSAGE}
        </Text>
      ) : null}
      <Button
        label={saving ? 'Creating…' : 'Create directory'}
        disabled={saving || !online || !name.trim()}
        onPress={() => void create()}
      />
    </Sheet>
  );
}

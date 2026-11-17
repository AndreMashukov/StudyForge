import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, mobileUiColors } from '@studyforge/mobile-ui';
import type { IMobileDirectory } from '../directories/api/directoryQueries';

export interface IDirectoryPicker {
  directories: IMobileDirectory[];
  selectedId: string | null;
  onSelect: (directoryId: string) => void;
  /** Optional first row, e.g. "Whole library" in the scope picker. */
  rootLabel?: string;
  onSelectRoot?: () => void;
}

/** Indented directory list in tree (path) order. */
export function DirectoryPicker({
  directories,
  selectedId,
  onSelect,
  rootLabel,
  onSelectRoot,
}: IDirectoryPicker) {
  const ordered = [...directories].sort((a, b) => a.path.localeCompare(b.path));
  return (
    <View className="rounded-3xl bg-card px-2 py-1">
      {rootLabel && onSelectRoot ? (
        <PickerRow
          label={rootLabel}
          icon="library-books"
          depth={0}
          selected={selectedId === null}
          onPress={onSelectRoot}
        />
      ) : null}
      {ordered.map((directory) => (
        <PickerRow
          key={directory.id}
          label={directory.name}
          icon="folder"
          depth={directory.level}
          selected={directory.id === selectedId}
          onPress={() => onSelect(directory.id)}
        />
      ))}
      {ordered.length === 0 ? (
        <Text tone="muted" className="px-2 py-3">
          No directories yet.
        </Text>
      ) : null}
    </View>
  );
}

function PickerRow({
  label,
  icon,
  depth,
  selected,
  onPress,
}: {
  label: string;
  icon: 'folder' | 'library-books';
  depth: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ paddingLeft: 8 + Math.min(depth, 6) * 18 }}
      className="min-h-12 flex-row items-center gap-3 pr-2"
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={mobileUiColors.mutedForeground}
      />
      <Text numberOfLines={1} className="flex-1">
        {label}
      </Text>
      {selected ? (
        <MaterialIcons name="check" size={20} color={mobileUiColors.accent} />
      ) : null}
    </Pressable>
  );
}

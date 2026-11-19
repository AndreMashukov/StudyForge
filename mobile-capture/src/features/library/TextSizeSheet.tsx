import { View } from 'react-native';
import { Text } from '@studyforge/mobile-ui';
import {
  READER_TEXT_SCALES,
  type ReaderTextScale,
} from '../../lib/storage/readerTextScaleStorage';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import { Chip, Sheet } from '../shell/ui';

const SCALE_LABELS: Record<ReaderTextScale, string> = {
  0.9: 'Small',
  1: 'Default',
  1.15: 'Large',
  1.3: 'Larger',
  1.5: 'Largest',
};

export interface ITextSizeSheet {
  visible: boolean;
  onClose: () => void;
}

/** Picks the reader text size; the choice persists across documents and launches. */
export function TextSizeSheet({ visible, onClose }: ITextSizeSheet) {
  const textScale = usePreferencesStore((state) => state.readerTextScale);
  const setTextScale = usePreferencesStore(
    (state) => state.setReaderTextScale,
  );
  return (
    <Sheet visible={visible} title="Text size" onClose={onClose}>
      <Text
        style={{ fontSize: 16 * textScale, lineHeight: 25 * textScale }}
        className="mb-4"
      >
        Documents will display at this size.
      </Text>
      <View className="flex-row flex-wrap gap-2 pb-2">
        {READER_TEXT_SCALES.map((scale) => (
          <Chip
            key={scale}
            label={SCALE_LABELS[scale]}
            selected={scale === textScale}
            onPress={() => setTextScale(scale)}
          />
        ))}
      </View>
    </Sheet>
  );
}

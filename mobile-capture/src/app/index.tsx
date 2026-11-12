import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@studyforge/mobile-ui';
import { CaptureScreen } from '../features/capture/screens/CaptureScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';

export default function IndexRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [tab, setTab] = useState<'capture' | 'library'>(view === 'library' ? 'library' : 'capture');
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const showCapture = useCallback(() => setTab('capture'), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (view === 'library') setTab('library');
  }, [view]);

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1, display: tab === 'capture' ? 'flex' : 'none' }}><CaptureScreen /></View>
      <View style={{ flex: 1, display: tab === 'library' ? 'flex' : 'none' }}><LibraryScreen active={focused && appActive && tab === 'library'} onCapture={showCapture} /></View>
      <View className="flex-row border-t border-border bg-background pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {(['capture', 'library'] as const).map((name) => (
          <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)} className="flex-1 items-center py-3">
            <Text tone={tab === name ? 'primary' : 'muted'}>{name === 'capture' ? 'Capture' : 'Library'}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

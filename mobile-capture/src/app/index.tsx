import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { TabBar, type ITabBarItem } from '@studyforge/mobile-ui';
import { CaptureScreen } from '../features/capture/screens/CaptureScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';

type IndexTab = 'capture' | 'library';

const TAB_ITEMS: ReadonlyArray<ITabBarItem<IndexTab>> = [
  { value: 'capture', label: 'Capture', icon: 'photo-camera' },
  { value: 'library', label: 'Library', icon: 'folder' },
];

export default function IndexRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [tab, setTab] = useState<IndexTab>(
    view === 'library' ? 'library' : 'capture',
  );
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const showCapture = useCallback(() => setTab('capture'), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (view === 'library') setTab('library');
  }, [view]);

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1, display: tab === 'capture' ? 'flex' : 'none' }}>
        <CaptureScreen />
      </View>
      <View style={{ flex: 1, display: tab === 'library' ? 'flex' : 'none' }}>
        <LibraryScreen
          active={focused && appActive && tab === 'library'}
          onCapture={showCapture}
        />
      </View>
      <TabBar items={TAB_ITEMS} value={tab} onValueChange={setTab} />
    </View>
  );
}

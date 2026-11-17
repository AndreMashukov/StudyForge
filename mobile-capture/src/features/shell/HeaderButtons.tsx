import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { HeaderIconButton } from '@studyforge/mobile-ui';

export function MenuButton() {
  const navigation = useNavigation();
  return (
    <HeaderIconButton
      icon="menu"
      accessibilityLabel="Open sidebar"
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
    />
  );
}

/** Back when there is history; otherwise the sidebar (deep links land without a stack). */
export function BackOrMenuButton() {
  const router = useRouter();
  if (!router.canGoBack()) return <MenuButton />;
  return (
    <HeaderIconButton
      icon="arrow-back"
      accessibilityLabel="Back"
      onPress={() => router.back()}
    />
  );
}

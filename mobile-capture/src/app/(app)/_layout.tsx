import { useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { mobileUiColors } from '@studyforge/mobile-ui';
import { AppDrawerContent } from '../../features/shell/AppDrawerContent';
import { CaptureSheet } from '../../features/capture/CaptureSheet';
import { NewDirectorySheet } from '../../features/shell/NewDirectorySheet';
import { useShellStore } from '../../features/shell/shellStore';

/** Sidebar shell (decision 2): one drawer around the main stack, plus the app-wide sheets. */
export default function AppLayout() {
  const router = useRouter();
  const newDirectory = useShellStore((state) => state.newDirectory);
  const closeNewDirectory = useShellStore((state) => state.closeNewDirectory);
  return (
    <>
      <Drawer
        drawerContent={(props) => <AppDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: { width: '86%', backgroundColor: mobileUiColors.card },
          overlayColor: 'rgba(0,0,0,0.28)',
          swipeEdgeWidth: 32,
        }}
      >
        <Drawer.Screen name="(main)" />
      </Drawer>
      <CaptureSheet />
      <NewDirectorySheet
        visible={Boolean(newDirectory)}
        parentId={newDirectory?.parentId ?? null}
        parentName={newDirectory?.parentName}
        onClose={closeNewDirectory}
        onCreated={(directoryId) => {
          closeNewDirectory();
          router.push({ pathname: '/dir/[id]', params: { id: directoryId } });
        }}
      />
    </>
  );
}

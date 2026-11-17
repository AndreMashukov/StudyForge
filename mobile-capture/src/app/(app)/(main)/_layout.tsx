import { Stack } from 'expo-router';
import { mobileUiColors } from '@studyforge/mobile-ui';

export default function MainStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: mobileUiColors.background },
      }}
    />
  );
}

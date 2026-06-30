import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Button } from '../Button';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { ScreenFooter } from './ScreenFooter';

const meta: Meta<typeof ScreenFooter> = {
  title: 'Components/ScreenFooter',
  component: ScreenFooter,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => (
      <View className="mx-auto min-h-screen w-full max-w-[390px] flex-1 bg-background">
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScreenFooter>;

export const SettingsActions: Story = {
  render: () => (
    <View className="min-h-screen flex-1 justify-end">
      <Text tone="muted" className="px-container pb-4">
        Scrollable content sits above this footer in real screens.
      </Text>
      <ScreenFooter>
        <Stack gap="sm">
          <Stack direction="horizontal" gap="sm">
            <Button
              label="Refresh"
              variant="secondary"
              shape="pill"
              size="sm"
              icon="sync"
              className="flex-1"
              onPress={() => undefined}
            />
            <Button
              label="Back to capture"
              variant="secondary"
              shape="pill"
              size="sm"
              icon="history"
              className="flex-1"
              onPress={() => undefined}
            />
          </Stack>
          <Button
            label="Sign out"
            variant="destructive"
            shape="pill"
            size="sm"
            icon="logout"
            onPress={() => undefined}
          />
        </Stack>
      </ScreenFooter>
    </View>
  ),
};

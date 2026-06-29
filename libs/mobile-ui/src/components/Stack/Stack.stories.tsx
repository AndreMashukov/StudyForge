import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Stack } from './Stack';
import { Text } from '../Text/Text';

const meta: Meta<typeof Stack> = {
  title: 'Layout/Stack',
  component: Stack,
};

export default meta;
type Story = StoryObj<typeof Stack>;

export const Vertical: Story = {
  render: () => (
    <View className="p-4">
      <Stack gap="md">
        <Text>First</Text>
        <Text>Second</Text>
        <Text>Third</Text>
      </Stack>
    </View>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <View className="p-4">
      <Stack direction="horizontal" gap="sm">
        <Text>Left</Text>
        <Text>Right</Text>
      </Stack>
    </View>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Divider } from './Divider';
import { Text } from '../Text/Text';

const meta: Meta<typeof Divider> = {
  title: 'Layout/Divider',
  component: Divider,
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Default: Story = {
  render: () => (
    <View className="p-4">
      <Text>Above</Text>
      <Divider />
      <Text>Below</Text>
    </View>
  ),
};

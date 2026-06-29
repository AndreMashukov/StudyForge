import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Foundations/Spinner',
  component: Spinner,
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  render: () => (
    <View className="p-4 items-center">
      <Spinner size="large" />
    </View>
  ),
};

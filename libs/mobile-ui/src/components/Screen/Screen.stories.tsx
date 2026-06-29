import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Text } from 'react-native';
import { Screen } from './Screen';

const meta: Meta<typeof Screen> = {
  title: 'Components/Screen',
  component: Screen,
};

export default meta;
type Story = StoryObj<typeof Screen>;

export const Default: Story = {
  render: () => (
    <Screen className="pt-4">
      <Text className="text-foreground text-xl font-bold">Screen content</Text>
    </Screen>
  ),
};

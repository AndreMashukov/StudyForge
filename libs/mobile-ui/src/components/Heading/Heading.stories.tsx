import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Heading } from './Heading';

const meta: Meta<typeof Heading> = {
  title: 'Foundations/Heading',
  component: Heading,
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Levels: Story = {
  render: () => (
    <View className="p-4 gap-2">
      <Heading level={1}>Heading 1</Heading>
      <Heading level={2}>Heading 2</Heading>
      <Heading level={3}>Heading 3</Heading>
      <Heading level={4}>Heading 4</Heading>
    </View>
  ),
};

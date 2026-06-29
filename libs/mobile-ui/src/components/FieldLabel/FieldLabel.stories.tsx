import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { FieldLabel } from './FieldLabel';

const meta: Meta<typeof FieldLabel> = {
  title: 'Components/FieldLabel',
  component: FieldLabel,
};

export default meta;
type Story = StoryObj<typeof FieldLabel>;

export const Default: Story = {
  render: () => (
    <View className="p-4">
      <FieldLabel>Email</FieldLabel>
    </View>
  ),
};

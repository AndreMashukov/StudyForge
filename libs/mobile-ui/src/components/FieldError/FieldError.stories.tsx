import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { FieldError } from './FieldError';

const meta: Meta<typeof FieldError> = {
  title: 'Components/FieldError',
  component: FieldError,
};

export default meta;
type Story = StoryObj<typeof FieldError>;

export const Default: Story = {
  render: () => (
    <View className="p-4">
      <FieldError message="This field is required." />
    </View>
  ),
};

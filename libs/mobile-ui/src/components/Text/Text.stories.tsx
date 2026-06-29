import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Foundations/Text',
  component: Text,
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {
  render: () => (
    <View className="p-4 gap-2">
      <Text>Body text</Text>
      <Text variant="caption" tone="muted">
        Caption text
      </Text>
      <Text variant="label" tone="primary">
        Label text
      </Text>
    </View>
  ),
};

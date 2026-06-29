import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from '../Text/Text';

const meta: Meta<typeof Card> = {
  title: 'Foundations/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <View className="p-4">
      <Card className="gap-2">
        <Text variant="label" tone="muted">
          Pipeline
        </Text>
        <Text>Document scanner → OCR → review → upload</Text>
      </Card>
    </View>
  ),
};

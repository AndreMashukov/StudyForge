import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Heading } from '../Heading/Heading';
import { Text } from '../Text/Text';
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
      <Heading level={3}>Screen content</Heading>
      <Text tone="muted" className="mt-2">
        Screen content sits on the page padding token.
      </Text>
    </Screen>
  ),
};

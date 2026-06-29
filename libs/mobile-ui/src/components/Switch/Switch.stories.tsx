import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Form/Switch',
  component: Switch,
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(true);
    return (
      <View className="p-4">
        <Switch value={value} onValueChange={setValue} label="Enable notifications" />
      </View>
    );
  },
};

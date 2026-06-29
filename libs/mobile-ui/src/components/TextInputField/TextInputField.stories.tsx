import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { TextInputField } from './TextInputField';

const meta: Meta<typeof TextInputField> = {
  title: 'Components/TextInputField',
  component: TextInputField,
};

export default meta;
type Story = StoryObj<typeof TextInputField>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <View className="p-4">
        <TextInputField value={value} onChangeText={setValue} placeholder="Enter text" />
      </View>
    );
  },
};

export const Multiline: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <View className="p-4">
        <TextInputField
          value={value}
          onChangeText={setValue}
          placeholder="Enter notes"
          multiline
          numberOfLines={6}
        />
      </View>
    );
  },
};

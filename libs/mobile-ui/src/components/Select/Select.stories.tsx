import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Form/Select',
  component: Select,
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <View className="p-4">
        <Select
          value={value}
          onValueChange={setValue}
          options={[
            { label: 'Documents', value: 'documents' },
            { label: 'Research', value: 'research' },
            { label: 'Archive', value: 'archive' },
          ]}
        />
      </View>
    );
  },
};

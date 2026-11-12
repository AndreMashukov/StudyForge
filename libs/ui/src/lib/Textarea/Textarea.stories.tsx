import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  args: {
    placeholder: 'Describe what you want to study…',
  },
  decorators: [
    (Story) => (
      <div className="w-96 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithLabelAndHelper: Story = {
  args: {
    label: 'Prompt',
    helperText: 'The more detail you give, the better the result.',
  },
};

export const WithError: Story = {
  args: {
    label: 'Prompt',
    defaultValue: 'Hi',
    error: 'Prompt must be at least 10 characters.',
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Generation in progress' },
};

function CharCountDemo() {
  const [value, setValue] = React.useState('Summarise chapter 4');

  return (
    <Textarea
      label="Prompt"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      showCharCount
      maxLength={120}
    />
  );
}

export const WithCharCount: Story = {
  render: () => <CharCountDemo />,
};

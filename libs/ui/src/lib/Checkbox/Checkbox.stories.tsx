import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { type ICheckbox } from './ICheckbox';

function ControlledCheckbox({ checked: initial = false, ...props }: ICheckbox) {
  const [checked, setChecked] = React.useState(initial);

  return <Checkbox {...props} checked={checked} onChange={setChecked} />;
}

const meta: Meta<typeof Checkbox> = {
  title: 'Components/Checkbox',
  component: Checkbox,
  render: (args) => <ControlledCheckbox {...args} />,
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = { args: { 'aria-label': 'Select document' } };
export const Checked: Story = {
  args: { checked: true, label: 'Add diagrams' },
};
export const WithDescription: Story = {
  args: {
    checked: true,
    label: 'Always apply',
    description: 'Attach this rule to every new generation.',
  },
};
export const Indeterminate: Story = {
  args: { indeterminate: true, label: 'Select all' },
};
export const WithError: Story = {
  args: { error: true, label: 'Accept the terms' },
};
export const Disabled: Story = {
  args: { disabled: true, checked: true, label: 'Locked option' },
};

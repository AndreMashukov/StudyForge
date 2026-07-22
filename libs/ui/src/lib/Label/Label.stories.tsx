import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './Label';
import { Input } from '../Input';

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
  args: {
    children: 'Email',
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const WithInput: Story = {
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <Label {...args} htmlFor="email" />
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

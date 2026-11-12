import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: {
    children: 'Badge',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Destructive: Story = { args: { variant: 'destructive' } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-2 p-4">
      <Badge>New</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="outline">Shared</Badge>
      <Badge variant="destructive">Failed</Badge>
    </div>
  ),
};

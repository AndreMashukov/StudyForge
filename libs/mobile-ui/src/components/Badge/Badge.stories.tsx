import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Foundations/Badge',
  component: Badge,
  args: { label: 'New' },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Outline: Story = { args: { variant: 'outline', label: 'Draft' } };

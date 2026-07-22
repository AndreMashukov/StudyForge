import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: {
    placeholder: 'Enter text…',
  },
  decorators: [
    (Story) => (
      <div className="w-72 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: 'StudyForge' } };
export const Password: Story = { args: { type: 'password', placeholder: 'Password' } };
export const Disabled: Story = { args: { disabled: true, placeholder: 'Disabled' } };

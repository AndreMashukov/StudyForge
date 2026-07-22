import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './Select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  decorators: [
    (Story) => (
      <div className="w-72 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Select>;

const FrameworkOptions = () => (
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Framework</SelectLabel>
      <SelectItem value="react">React</SelectItem>
      <SelectItem value="vue">Vue</SelectItem>
      <SelectItem value="svelte">Svelte</SelectItem>
      <SelectItem value="angular">Angular</SelectItem>
    </SelectGroup>
  </SelectContent>
);

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <FrameworkOptions />
    </Select>
  ),
};

export const WithValue: Story = {
  render: () => (
    <Select defaultValue="react">
      <SelectTrigger aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <FrameworkOptions />
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled defaultValue="react">
      <SelectTrigger aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <FrameworkOptions />
    </Select>
  ),
};

export const WithDisabledItem: Story = {
  render: () => (
    <Select>
      <SelectTrigger aria-label="Framework">
        <SelectValue placeholder="Select a framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="react">React</SelectItem>
        <SelectItem value="vue" disabled>
          Vue (unavailable)
        </SelectItem>
        <SelectItem value="svelte">Svelte</SelectItem>
      </SelectContent>
    </Select>
  ),
};

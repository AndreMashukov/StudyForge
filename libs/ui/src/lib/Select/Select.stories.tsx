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

/** Reproduces admin LLM-setup stacked selects in an overflow container. */
export const StackedInOverflow: Story = {
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="w-80 overflow-x-auto rounded-lg border border-border p-3">
        <Story />
      </div>
    ),
  ],
  render: () => {
    const options = [
      { value: 'gemini', label: 'Primary Gemini (gemini)' },
      { value: 'minimax', label: 'Primary MiniMax (minimax)' },
      { value: 'openrouter', label: 'Primary OpenRouter (openrouter)' },
      { value: 'together', label: 'Primary Together (together)' },
    ];

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Provider connection</p>
        {['a', 'b', 'c'].map((row) => (
          <Select key={row} defaultValue="gemini">
            <SelectTrigger aria-label={`Provider connection ${row}`}>
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
    );
  },
};

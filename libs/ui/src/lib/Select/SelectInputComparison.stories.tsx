import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../Input';
import { Label } from '../Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select';

const meta: Meta = {
  title: 'Components/Select/Input Comparison',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

interface IComparisonRowProps {
  label: string;
  input: ReactNode;
  select: ReactNode;
}

function ComparisonRow({ label, input, select }: IComparisonRowProps) {
  return (
    <div className="grid grid-cols-[8rem_1fr_1fr] items-end gap-4">
      <p className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Input</Label>
        {input}
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Select</Label>
        {select}
      </div>
    </div>
  );
}

export const SideBySide: Story = {
  name: 'Side by side with Input',
  render: () => (
    <div className="flex w-[40rem] flex-col gap-6 p-4">
      <p className="text-sm text-muted-foreground">
        Select trigger styles share the same field surface as Input (`h-10`,
        padding, border, colors, hover, focus, disabled).
      </p>

      <ComparisonRow
        label="Placeholder"
        input={<Input placeholder="Select a framework" />}
        select={
          <Select>
            <SelectTrigger aria-label="Framework">
              <SelectValue placeholder="Select a framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ComparisonRow
        label="With value"
        input={<Input defaultValue="React" />}
        select={
          <Select defaultValue="react">
            <SelectTrigger aria-label="Framework">
              <SelectValue placeholder="Select a framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <ComparisonRow
        label="Disabled"
        input={<Input disabled defaultValue="React" />}
        select={
          <Select disabled defaultValue="react">
            <SelectTrigger aria-label="Framework">
              <SelectValue placeholder="Select a framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="react">React</SelectItem>
              <SelectItem value="vue">Vue</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  ),
};

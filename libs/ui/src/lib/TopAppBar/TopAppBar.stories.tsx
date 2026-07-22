import type { Meta, StoryObj } from '@storybook/react-vite';
import { Menu } from 'lucide-react';
import {
  TopAppBar,
  TopAppBarBrand,
  TopAppBarBrandContent,
  TopAppBarMenuButton,
} from './TopAppBar';
import { ThemeToggle } from '../Theme';

const meta: Meta<typeof TopAppBar> = {
  title: 'Components/TopAppBar',
  component: TopAppBar,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof TopAppBar>;

const mascotSrc =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d2bbff"><circle cx="12" cy="12" r="10"/></svg>'
  );

export const Default: Story = {
  args: {
    start: (
      <TopAppBarMenuButton
        aria-label="Open menu"
        icon={<Menu className="h-4 w-4" />}
      />
    ),
    brand: (
      <TopAppBarBrand>
        <TopAppBarBrandContent mascotSrc={mascotSrc} title="StudyForge" />
      </TopAppBarBrand>
    ),
    end: <ThemeToggle />,
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './ThemeProvider';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Components/Theme',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

function ThemeDemo() {
  const { currentTheme, currentThemeId } = useTheme();

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Active theme</p>
        <p className="text-lg font-semibold">{currentTheme.name}</p>
        <p className="text-xs text-muted-foreground">{currentThemeId}</p>
      </div>
      <ThemeToggle />
    </div>
  );
}

export const Toggle: Story = {
  render: () => <ThemeDemo />,
};

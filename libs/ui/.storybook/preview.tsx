import type { Preview } from '@storybook/react-vite';
import { ThemeProvider } from '../src/lib/Theme';
import './styles.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="linear" storageKey="storybook-ui-theme">
        <div className="bg-background text-foreground">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;

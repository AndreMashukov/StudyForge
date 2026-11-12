import type { Preview } from '@storybook/react-native-web-vite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
import './storybook-fonts.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <div
          className="font-sans"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgb(255, 255, 255)',
          }}
        >
          <Story />
        </div>
      </SafeAreaProvider>
    ),
  ],
};

export default preview;

import type { Preview } from '@storybook/react-native-web-vite';
import '../global.css';
import './storybook-fonts.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div
        className="dark font-sans"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgb(18, 20, 20)',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;

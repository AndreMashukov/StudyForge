import type { Preview } from '@storybook/react-native-web-vite';
import '../global.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000000' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;

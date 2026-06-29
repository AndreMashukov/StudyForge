import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { LoadingState } from './LoadingState';

const meta: Meta<typeof LoadingState> = {
  title: 'Components/LoadingState',
  component: LoadingState,
};

export default meta;
type Story = StoryObj<typeof LoadingState>;

export const Default: Story = {
  args: { message: 'Loading StudyForge…' },
};

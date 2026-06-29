import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Screen } from '../Screen/Screen';
import { Text } from '../Text/Text';
import { HeaderIconButton } from './HeaderIconButton';
import { ScreenHeader } from './ScreenHeader';

const meta: Meta<typeof ScreenHeader> = {
  title: 'Components/ScreenHeader',
  component: ScreenHeader,
};

export default meta;
type Story = StoryObj<typeof ScreenHeader>;

export const ScanStudyForge: Story = {
  render: () => (
    <Screen className="pt-0">
      <ScreenHeader
        title="Scan to StudyForge"
        leading={
          <HeaderIconButton icon="menu" accessibilityLabel="Open menu" onPress={() => undefined} />
        }
        trailing={
          <HeaderIconButton
            icon="settings"
            accessibilityLabel="Open settings"
            onPress={() => undefined}
          />
        }
      />
      <Text tone="muted" className="mt-6">
        Header from the Stitch &quot;Scan - StudyForge&quot; slide.
      </Text>
    </Screen>
  ),
};

export const TitleOnly: Story = {
  args: {
    title: 'Settings',
  },
  render: (args) => (
    <Screen className="pt-0">
      <ScreenHeader {...args} />
    </Screen>
  ),
};

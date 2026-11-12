import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState } from 'react';
import { View } from 'react-native';
import { TabBar } from './TabBar';

type DemoTab = 'capture' | 'library';

const items = [
  { value: 'capture', label: 'Capture', icon: 'photo-camera' },
  { value: 'library', label: 'Library', icon: 'folder' },
] as const;

function TabBarDemo({ initial }: { initial: DemoTab }) {
  const [tab, setTab] = useState<DemoTab>(initial);
  return (
    <View className="w-full max-w-[390px]">
      <TabBar items={items} value={tab} onValueChange={setTab} />
    </View>
  );
}

const meta: Meta<typeof TabBarDemo> = {
  title: 'Components/TabBar',
  component: TabBarDemo,
  args: { initial: 'capture' },
};

export default meta;
type Story = StoryObj<typeof TabBarDemo>;

export const CaptureSelected: Story = {};
export const LibrarySelected: Story = { args: { initial: 'library' } };

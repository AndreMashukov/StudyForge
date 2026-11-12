import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text as NativeText, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FieldError } from '../components/FieldError';
import { FieldLabel } from '../components/FieldLabel';
import { Screen } from '../components/Screen';
import { ScreenFooter } from '../components/ScreenFooter';
import { HeaderIconButton, ScreenHeader } from '../components/ScreenHeader';
import { Stack } from '../components/Stack';
import { TabBar } from '../components/TabBar';
import { Text } from '../components/Text';
import { TextInputField } from '../components/TextInputField';
import { mobileUiColors } from '../tokens/colors';

/**
 * Preview-only mock-ups of the mobile-capture screens, built from the same
 * mobile-ui components and class names the real screens use. They carry sample
 * data instead of Firebase / scanner / router wiring.
 */

const noop = () => undefined;

type AppTab = 'capture' | 'library';

const tabItems = [
  { value: 'capture', label: 'Capture', icon: 'photo-camera' },
  { value: 'library', label: 'Library', icon: 'folder' },
] as const;

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View className="items-center bg-muted py-6" style={{ minHeight: '100%' }}>
      <View
        className="overflow-hidden rounded-[36px] border border-border bg-background shadow-field"
        style={{ width: 390, height: 844 }}
      >
        <View className="h-9 flex-row items-center justify-between bg-background px-6">
          <NativeText className="text-xs font-sans-semibold text-foreground">18:30</NativeText>
          <NativeText className="text-xs font-sans-semibold text-foreground">5G · 56%</NativeText>
        </View>
        {children}
      </View>
    </View>
  );
}

function WithTabBar({ initial, children }: { initial: AppTab; children: ReactNode }) {
  const [tab, setTab] = useState<AppTab>(initial);
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">{children}</View>
      <TabBar items={tabItems} value={tab} onValueChange={setTab} />
    </View>
  );
}

function CaptureScreenPreview({ hasDirectory }: { hasDirectory: boolean }) {
  return (
    <WithTabBar initial="capture">
      <Screen className="pt-0">
        <ScreenHeader
          title="Scan to StudyForge"
          trailing={<HeaderIconButton icon="settings" accessibilityLabel="Open settings" onPress={noop} />}
        />

        <Card className="mt-2 mb-5 gap-2">
          <Text variant="label" tone="muted">
            Pipeline
          </Text>
          <Text>Document scanner → on-device OCR → review → upload</Text>
        </Card>

        <Stack gap="xs" className="mb-5">
          <Text variant="label" tone="muted">
            Status
          </Text>
          <Text>Ready</Text>

          <Text variant="label" tone="muted" className="mt-3 mb-2">
            Default directory
          </Text>
          <Pressable
            accessibilityRole="button"
            className="rounded-lg border border-border bg-card px-3.5 py-3.5 min-h-12 mb-2"
          >
            {hasDirectory ? (
              <Stack gap="xs">
                <Text className="font-sans-semibold">Python</Text>
                <Text tone="muted">/Mandarin/TextTransform1/Python</Text>
                <Text tone="primary">Tap to change directory</Text>
              </Stack>
            ) : (
              <Stack gap="xs">
                <Text className="font-sans-semibold">Not selected</Text>
                <Text tone="primary">Tap to choose a directory</Text>
              </Stack>
            )}
          </Pressable>
          <Text tone="muted">145 directories in your library</Text>
          {hasDirectory ? (
            <Text tone="accent" className="mt-2">
              Latest document: Lecture notes (doc_8f2k1)
            </Text>
          ) : null}
        </Stack>

        <Stack gap="sm">
          <Button
            label={hasDirectory ? 'Change directory' : 'Choose directory'}
            variant="secondary"
            onPress={noop}
          />
          <Button label="Scan document" disabled={!hasDirectory} onPress={noop} />
          <Button label="Refresh directories" variant="secondary" onPress={noop} />
          <Button label="Sign out" variant="secondary" onPress={noop} />
        </Stack>
      </Screen>
    </WithTabBar>
  );
}

const libraryRows = [
  { kind: 'heading', title: 'Directories' },
  { kind: 'row', title: 'Flashcards' },
  { kind: 'row', title: 'Week 3' },
  { kind: 'heading', title: 'Documents' },
  { kind: 'row', title: 'Generators and iterators', detail: 'document' },
  { kind: 'row', title: 'Scanned handout', detail: 'document · pending' },
  { kind: 'heading', title: 'Artifacts' },
  { kind: 'row', title: 'Generators quiz', detail: 'quiz' },
] as const;

function LibraryScreenPreview() {
  const [search, setSearch] = useState('');
  return (
    <WithTabBar initial="library">
      <Screen className="pt-0">
        <ScreenHeader title="Library" />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Stack gap="sm" className="mt-5 mb-4">
            <View className="flex-row flex-wrap items-center">
              <Text tone="primary">Library</Text>
              <Text tone="muted"> / </Text>
              <Text tone="primary">Mandarin</Text>
              <Text tone="muted"> / </Text>
              <Text tone="primary">Python</Text>
            </View>
            <TextInputField
              value={search}
              onChangeText={setSearch}
              placeholder="Search this directory…"
              autoCapitalize="none"
            />
            <Button label="Capture here" icon="photo-camera" onPress={noop} />
          </Stack>
          {libraryRows.map((row) =>
            row.kind === 'heading' ? (
              <Text key={row.title} className="font-sans-semibold mt-4 mb-2">
                {row.title}
              </Text>
            ) : (
              <Pressable
                key={row.title}
                accessibilityRole="button"
                className="rounded-lg border border-border bg-card px-4 py-3 mb-2"
              >
                <Text className="font-sans-semibold">{row.title}</Text>
                {'detail' in row ? <Text tone="muted">{row.detail}</Text> : null}
              </Pressable>
            )
          )}
        </ScrollView>
      </Screen>
    </WithTabBar>
  );
}

function ReaderText({
  kind,
  children,
}: {
  kind: 'heading' | 'paragraph' | 'list' | 'code';
  children: ReactNode;
}) {
  return (
    <NativeText
      className={kind === 'heading' ? 'font-sans-bold' : 'font-sans'}
      style={{
        color: mobileUiColors.foreground,
        fontSize: kind === 'heading' ? 24 : 16,
        lineHeight: kind === 'heading' ? 34 : 25,
        marginVertical: 7,
        padding: kind === 'code' ? 12 : 0,
        backgroundColor: kind === 'code' ? mobileUiColors.muted : 'transparent',
        fontFamily: kind === 'code' ? 'monospace' : undefined,
      }}
    >
      {kind === 'list' ? '• ' : ''}
      {children}
    </NativeText>
  );
}

function DocumentReaderPreview() {
  return (
    <Screen className="pt-0">
      <ScreenHeader
        title="Generators and iterators"
        leading={<HeaderIconButton icon="arrow-back" accessibilityLabel="Back to library" onPress={noop} />}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 20 }}>
        <Stack gap="sm">
          <Button label="Open original in browser" variant="secondary" onPress={noop} />
          <ReaderText kind="heading">Generators</ReaderText>
          <ReaderText kind="paragraph">
            A generator is a function that yields values one at a time and keeps its state between calls. See the{' '}
            <NativeText style={{ color: mobileUiColors.primary, textDecorationLine: 'underline' }}>
              Python docs
            </NativeText>{' '}
            for details.
          </ReaderText>
          <ReaderText kind="list">Values are produced lazily</ReaderText>
          <ReaderText kind="list">Memory use stays constant</ReaderText>
          <ReaderText kind="code">{'def count():\n    n = 0\n    while True:\n        yield n\n        n += 1'}</ReaderText>
        </Stack>
      </ScrollView>
    </Screen>
  );
}

const settingsDirectories = [
  { id: 'python', name: 'Python', path: '/Mandarin/TextTransform1/Python' },
  { id: 'week3', name: 'Week 3', path: '/Mandarin/TextTransform1/Python/Week 3' },
  { id: 'aws', name: 'AWS', path: '/Certifications/AWS' },
];

function SettingsScreenPreview() {
  const [selected, setSelected] = useState('python');
  const [search, setSearch] = useState('');
  return (
    <Screen className="pt-0">
      <ScreenHeader
        title="Settings"
        leading={<HeaderIconButton icon="arrow-back" accessibilityLabel="Back to capture" onPress={noop} />}
      />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Stack gap="sm" className="mt-6 mb-4">
          <Text variant="label" tone="muted">
            Default directory
          </Text>
          <TextInputField value={search} onChangeText={setSearch} placeholder="Search directories…" />
        </Stack>
        <Stack gap="sm">
          {settingsDirectories.map((directory) => (
            <Pressable
              key={directory.id}
              accessibilityRole="button"
              onPress={() => setSelected(directory.id)}
              className={`min-h-12 rounded-lg border px-3.5 py-3.5 ${directory.id === selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
            >
              <Text className="font-sans-semibold">{directory.name}</Text>
              <Text tone="muted" className="mt-1">
                {directory.path}
              </Text>
            </Pressable>
          ))}
        </Stack>
      </ScrollView>
      <ScreenFooter>
        <Stack gap="sm">
          <Stack direction="horizontal" gap="sm">
            <Button label="Refresh" variant="secondary" size="sm" icon="sync" className="flex-1" onPress={noop} />
            <Button
              label="Back to capture"
              variant="secondary"
              size="sm"
              icon="history"
              className="flex-1"
              onPress={noop}
            />
          </Stack>
          <Button label="Sign out" variant="destructive" size="sm" icon="logout" onPress={noop} />
        </Stack>
      </ScreenFooter>
    </Screen>
  );
}

function SignInScreenPreview({ error }: { error?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <Screen className="pt-0">
      <ScreenHeader title="Sign in to capture" />
      <Text tone="muted" className="mt-6 mb-8 leading-6">
        Use the same Firebase account as the web app.
      </Text>
      <Stack gap="sm">
        <View className="mb-2">
          <FieldLabel>Email</FieldLabel>
          <TextInputField
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View className="mb-2">
          <FieldLabel>Password</FieldLabel>
          <TextInputField value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        </View>
        <FieldError message={error} />
        <Button label="Sign in" onPress={noop} />
      </Stack>
    </Screen>
  );
}

function ReviewScreenPreview() {
  const [title, setTitle] = useState('Lecture notes');
  const [content, setContent] = useState(
    'Generators yield values one at a time.\nThey keep their state between calls.'
  );
  return (
    <Screen className="pt-0">
      <ScreenHeader
        title="Review capture"
        leading={<HeaderIconButton icon="arrow-back" accessibilityLabel="Back to capture" onPress={noop} />}
      />
      <Text tone="muted" className="mt-6 mb-4">
        Edit OCR text or send the scanned image for AI document generation.
      </Text>
      <View className="w-full h-40 rounded-lg border border-border bg-muted mb-4 items-center justify-center">
        <Text tone="muted" variant="caption">
          Scanned image
        </Text>
      </View>
      <View className="mb-2">
        <FieldLabel>Title</FieldLabel>
        <TextInputField value={title} onChangeText={setTitle} placeholder="Document title" />
      </View>
      <View className="mb-2">
        <FieldLabel>OCR text</FieldLabel>
        <TextInputField
          value={content}
          onChangeText={setContent}
          placeholder="Recognized text"
          multiline
          numberOfLines={8}
        />
      </View>
      <Stack gap="sm" className="mt-2">
        <Button label="Save OCR text as document" onPress={noop} />
        <Button label="Send image to StudyForge AI" variant="secondary" onPress={noop} />
        <Button label="Cancel" variant="secondary" onPress={noop} />
      </Stack>
    </Screen>
  );
}

const meta: Meta = {
  title: 'Mobile Capture/Screens',
  decorators: [
    (Story) => (
      <PhoneFrame>
        <Story />
      </PhoneFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Capture: Story = { render: () => <CaptureScreenPreview hasDirectory /> };
export const CaptureNoDirectory: Story = { render: () => <CaptureScreenPreview hasDirectory={false} /> };
export const Library: Story = { render: () => <LibraryScreenPreview /> };
export const DocumentReader: Story = { render: () => <DocumentReaderPreview /> };
export const Settings: Story = { render: () => <SettingsScreenPreview /> };
export const SignIn: Story = { render: () => <SignInScreenPreview /> };
export const SignInError: Story = {
  render: () => <SignInScreenPreview error="The email or password is incorrect." />,
};
export const ReviewCapture: Story = { render: () => <ReviewScreenPreview /> };

import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Button,
  Text,
  TextInputField,
  mobileUiColors,
} from '@studyforge/mobile-ui';
import {
  useDirectoryTreeQuery,
  flattenDirectoryTree,
} from '../directories/api/directoryQueries';
import { usePreferencesStore } from '../preferences/store/preferencesStore';
import { useCaptureStore } from './store/captureStore';
import {
  CaptureScanCommandHandler,
  recognizeImageText,
} from './services/CaptureScanCommandHandler';
import {
  createDocumentFromPastedText,
  createDocumentFromUrl,
  getCallableErrorMessage,
} from '../../lib/api/studyforgeApi';
import { OFFLINE_MESSAGE, useIsOnline } from '../../lib/network/online';
import { directoryPath } from '../library/librarySearch';
import { DirectoryPicker } from '../shell/DirectoryPicker';
import { useShellStore } from '../shell/shellStore';
import { Sheet } from '../shell/ui';

type Step = 'sources' | 'destination' | 'paste' | 'link';
type IconName = keyof typeof MaterialIcons.glyphMap;

const URL_PATTERN = /^https?:\/\/\S+$/i;
/** Matches createDocumentFromPastedText's server-side minimum. */
const MIN_PASTE_TEXT_LENGTH = 10;

/**
 * The composer's + (decisions 9, 10). Captures go to the screen's directory, or from
 * outside any directory to the default capture directory, which is asked for once.
 */
export function CaptureSheet() {
  const router = useRouter();
  const online = useIsOnline();
  const capture = useShellStore((state) => state.capture);
  const closeCapture = useShellStore((state) => state.closeCapture);
  const defaultDirectoryId = usePreferencesStore(
    (state) => state.defaultDirectoryId,
  );
  const setDefaultDirectoryId = usePreferencesStore(
    (state) => state.setDefaultDirectoryId,
  );
  const setPendingScan = useCaptureStore((state) => state.setPendingScan);
  const treeQuery = useDirectoryTreeQuery();
  const directories = useMemo(
    () => flattenDirectoryTree(treeQuery.data?.tree ?? []),
    [treeQuery.data],
  );
  const handler = useMemo(() => new CaptureScanCommandHandler(), []);

  const fromDirectory = capture?.directoryId ?? null;
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('sources');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!capture) return;
    const initial = capture.directoryId ?? defaultDirectoryId;
    const known =
      initial && directories.some((directory) => directory.id === initial)
        ? initial
        : null;
    setDestinationId(known);
    setStep(known ? 'sources' : 'destination');
    setText('');
    setError(null);
  }, [capture, defaultDirectoryId, directories]);

  const close = () => {
    if (!busy) closeCapture();
  };

  const chooseDestination = (directoryId: string) => {
    setDestinationId(directoryId);
    // From home, the chosen directory becomes the default capture directory.
    if (!fromDirectory) setDefaultDirectoryId(directoryId);
    setStep('sources');
  };

  const reviewImage = (imageUri: string, ocrText: string) => {
    if (!destinationId) return;
    setPendingScan({ imageUri, ocrText, directoryId: destinationId });
    closeCapture();
    router.push('/scan/review');
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (taskError) {
      setError(getCallableErrorMessage(taskError));
    } finally {
      setBusy(false);
    }
  };

  const scan = () =>
    run(async () => {
      if (!destinationId) return;
      const result = await handler.handle(destinationId);
      if (result) reviewImage(result.imageUri, result.ocrText);
    });

  const pickImage = (source: 'camera' | 'library') =>
    run(async () => {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(
          source === 'camera'
            ? 'Camera access is off. Turn it on in Settings.'
            : 'Photo access is off. Turn it on in Settings.',
        );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.85,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      reviewImage(asset.uri, await recognizeImageText(asset.uri));
    });

  const startLink = async () => {
    const clip = await Clipboard.getStringAsync().catch(() => '');
    setText(URL_PATTERN.test(clip.trim()) ? clip.trim() : '');
    setStep('link');
  };

  const submitText = () =>
    run(async () => {
      if (!destinationId) return;
      if (step === 'paste') {
        await createDocumentFromPastedText({
          content: text.trim(),
          directoryId: destinationId,
        });
      } else {
        await createDocumentFromUrl({
          url: text.trim(),
          directoryId: destinationId,
        });
      }
      closeCapture();
      router.push({ pathname: '/dir/[id]', params: { id: destinationId } });
    });

  const destinationName = destinationId
    ? directoryPath(directories, destinationId)
    : 'Not chosen';

  return (
    <Sheet
      visible={Boolean(capture)}
      title={step === 'destination' ? 'Save captures to' : 'Capture'}
      onClose={close}
    >
      {step !== 'destination' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Choose a different directory"
          onPress={() => setStep('destination')}
          className="mb-3 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3"
        >
          <MaterialIcons
            name="folder"
            size={20}
            color={mobileUiColors.mutedForeground}
          />
          <View className="flex-1">
            <Text variant="caption" tone="muted">
              Save to
            </Text>
            <Text numberOfLines={1} className="font-sans-medium">
              {destinationName}
            </Text>
          </View>
          <Text tone="accent">Change</Text>
        </Pressable>
      ) : null}

      {step === 'destination' ? (
        <>
          <Text tone="muted" className="mb-3">
            {fromDirectory
              ? 'Choose where this capture goes.'
              : 'Captures from home go to your default capture directory.'}
          </Text>
          <DirectoryPicker
            directories={directories}
            selectedId={destinationId}
            onSelect={chooseDestination}
          />
        </>
      ) : null}

      {step === 'sources' ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <SourceTile
              icon="document-scanner"
              label="Scan"
              disabled={busy}
              onPress={() => void scan()}
            />
            <SourceTile
              icon="photo-camera"
              label="Camera"
              disabled={busy}
              onPress={() => void pickImage('camera')}
            />
            <SourceTile
              icon="image"
              label="Photos"
              disabled={busy}
              onPress={() => void pickImage('library')}
            />
            <SourceTile
              icon="content-paste"
              label="Paste text"
              disabled={busy || !online}
              onPress={() => {
                setText('');
                setStep('paste');
              }}
            />
            <SourceTile
              icon="link"
              label="Web link"
              disabled={busy || !online}
              onPress={() => void startLink()}
            />
          </View>
          <Text variant="caption" tone="muted" className="mt-3">
            Each capture becomes a document in this directory.
          </Text>
        </>
      ) : null}

      {step === 'paste' || step === 'link' ? (
        <>
          <TextInputField
            value={text}
            onChangeText={setText}
            placeholder={
              step === 'paste' ? 'Paste or type the text' : 'https://…'
            }
            autoCapitalize="none"
            keyboardType={step === 'link' ? 'url' : 'default'}
            multiline={step === 'paste'}
            numberOfLines={step === 'paste' ? 8 : undefined}
          />
          <Button
            label={
              busy
                ? 'Saving…'
                : step === 'paste'
                  ? 'Save as document'
                  : 'Import page'
            }
            disabled={
              busy ||
              !online ||
              (step === 'link'
                ? !URL_PATTERN.test(text.trim())
                : text.trim().length < MIN_PASTE_TEXT_LENGTH)
            }
            onPress={() => void submitText()}
          />
          <Button
            label="Back"
            variant="ghost"
            onPress={() => setStep('sources')}
            className="mt-1"
          />
        </>
      ) : null}

      {!online && step !== 'destination' ? (
        <Text tone="muted" className="mt-2">
          {OFFLINE_MESSAGE}
        </Text>
      ) : null}
      {error ? (
        <Text tone="destructive" className="mt-2">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

function SourceTile({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="w-[31.5%] items-center gap-2 rounded-2xl bg-card py-4"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <MaterialIcons name={icon} size={24} color={mobileUiColors.foreground} />
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

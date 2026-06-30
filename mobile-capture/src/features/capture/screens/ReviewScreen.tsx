import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { DocumentSourceType } from '@shared-types';
import {
  Button,
  Form,
  FormRootError,
  FormTextInput,
  HeaderIconButton,
  Screen,
  ScreenHeader,
  Stack,
  Text,
} from '@studyforge/mobile-ui';
import {
  IReviewDocumentFormValues,
  reviewDocumentSchema,
} from '../schemas/reviewSchemas';
import { useCaptureStore } from '../store/captureStore';
import { useCreateDocumentMutation, useGenerateFromScreenshotMutation } from '../../directories/api/directoryQueries';
import { deriveTitleFromContent, prepareImageBase64DataUrl } from '../../../lib/capture/imageEncoding';
import { getCallableErrorMessage } from '../../../lib/api/studyforgeApi';

export function ReviewScreen() {
  const router = useRouter();
  const pendingScan = useCaptureStore((state) => state.pendingScan);
  const setPendingScan = useCaptureStore((state) => state.setPendingScan);
  const setLastResult = useCaptureStore((state) => state.setLastResult);
  const setStatusMessage = useCaptureStore((state) => state.setStatusMessage);

  const createDocumentMutation = useCreateDocumentMutation();
  const generateFromScreenshotMutation = useGenerateFromScreenshotMutation();

  const form = useForm<IReviewDocumentFormValues>({
    resolver: zodResolver(reviewDocumentSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  useEffect(() => {
    if (!pendingScan) {
      return;
    }
    form.reset({
      title: deriveTitleFromContent(pendingScan.ocrText),
      content: pendingScan.ocrText || '',
    });
  }, [form, pendingScan]);

  if (!pendingScan) {
    return (
      <Screen className="pt-0 justify-center">
        <ScreenHeader
          title="Review capture"
          leading={
            <HeaderIconButton
              icon="arrow-back"
              accessibilityLabel="Back to capture"
              onPress={() => router.back()}
            />
          }
        />
        <Text tone="muted" className="mt-6 mb-4">
          No scan is ready for review.
        </Text>
        <Button label="Back to capture" onPress={() => router.back()} />
      </Screen>
    );
  }

  const submitTextDocument = form.handleSubmit(async (values) => {
    try {
      const response = await createDocumentMutation.mutateAsync({
        title: values.title,
        content: values.content,
        directoryId: pendingScan.directoryId,
        sourceType: DocumentSourceType.UPLOAD,
        description: 'Captured from mobile OCR',
        tags: ['ocr', 'mobile-capture', 'scanned'],
      });

      setLastResult(response.document.id, response.document.title);
      setStatusMessage(`Created "${response.document.title}" from OCR text.`);
      setPendingScan(null);
      router.back();
    } catch (error) {
      form.setError('root', { message: getCallableErrorMessage(error) });
    }
  });

  const submitVisionDocument = async () => {
    try {
      const imageBase64 = await prepareImageBase64DataUrl(pendingScan.imageUri);
      const formTitle = form.getValues('title').trim();
      const response = await generateFromScreenshotMutation.mutateAsync({
        imageBase64,
        directoryId: pendingScan.directoryId,
        title: formTitle || undefined,
        prompt: form.getValues('content') || undefined,
      });

      const displayTitle = response.title?.trim() || formTitle || 'Captured Document';
      setLastResult(response.documentId, displayTitle);

      if (response.generationStatus === 'pending') {
        setStatusMessage(
          `Document "${displayTitle}" is generating in StudyForge. Open the web app to view it when ready.`
        );
      } else {
        setStatusMessage(`Created "${displayTitle}" from scanned image.`);
      }

      setPendingScan(null);
      router.back();
    } catch (error) {
      form.setError('root', { message: getCallableErrorMessage(error) });
    }
  };

  const isSubmitting = createDocumentMutation.isPending || generateFromScreenshotMutation.isPending;

  return (
    <Screen className="pt-0">
      <ScreenHeader
        title="Review capture"
        leading={
          <HeaderIconButton
            icon="arrow-back"
            accessibilityLabel="Back to capture"
            onPress={() => router.back()}
          />
        }
      />
      <Text tone="muted" className="mt-6 mb-4">
        Edit OCR text or send the scanned image for AI document generation.
      </Text>

      <Image
        source={{ uri: pendingScan.imageUri }}
        className="w-full h-40 rounded-lg border border-border mb-4"
        resizeMode="cover"
      />

      <Form {...form}>
        <FormTextInput
          control={form.control}
          name="title"
          label="Title"
          placeholder="Document title"
        />

        <FormTextInput
          control={form.control}
          name="content"
          label="OCR text"
          placeholder="Recognized text"
          multiline
          numberOfLines={8}
        />

        <FormRootError />

        <Stack gap="sm" className="mt-2">
          <Button
            label={isSubmitting ? 'Saving…' : 'Save OCR text as document'}
            disabled={isSubmitting}
            onPress={() => void submitTextDocument()}
          />
          <Button
            label={isSubmitting ? 'Sending…' : 'Send image to StudyForge AI'}
            variant="secondary"
            disabled={isSubmitting}
            onPress={() => void submitVisionDocument()}
          />
          <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
        </Stack>
      </Form>
    </Screen>
  );
}

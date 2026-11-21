import { GoogleGenAI } from '@google/genai';
import { DEFAULT_DOCUMENT_NARRATION_VOICE } from '@shared-types';
import { LlmGenerationRouteResolver } from './llm-generation-route-resolver';
import { decodeSpeechAudio, type IPcmAudio } from './speech-audio';
import { trackedGeminiGenerateContent } from './tracked-gemini-generate';

/**
 * Speech generation for document narration. The model and voice come from the
 * `documentNarration` generation route; only Gemini serves the `speech` modality.
 */

export interface ISpeechRoute {
  connectionId: string;
  model: string;
  voice: string;
  apiKey: string;
}

export async function resolveNarrationSpeechRoute(
  userId: string,
): Promise<ISpeechRoute> {
  const resolution = await LlmGenerationRouteResolver.resolve(
    'documentNarration',
    { userId },
  );
  if (resolution.route.providerType !== 'gemini') {
    throw new Error(
      `Document narration needs a Gemini connection, but the route uses ${resolution.route.providerType}`,
    );
  }
  if (!resolution.providerApiKey) {
    throw new Error('Gemini credentials are missing for document narration');
  }
  return {
    connectionId: resolution.route.connectionId,
    model: resolution.route.model,
    voice: resolution.voice || DEFAULT_DOCUMENT_NARRATION_VOICE,
    apiKey: resolution.providerApiKey,
  };
}

/** Reads `text` aloud in the route's voice. Returns mono 16-bit PCM. */
export async function synthesizeSpeech(
  route: ISpeechRoute,
  text: string,
  timeoutMs = 90_000,
): Promise<IPcmAudio> {
  const client = new GoogleGenAI({ apiKey: route.apiKey });
  const response = await trackedGeminiGenerateContent(
    client,
    {
      model: route.model,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        httpOptions: { timeout: timeoutMs },
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode: 'en-US',
          voiceConfig: { prebuiltVoiceConfig: { voiceName: route.voice } },
        },
      },
    },
    {
      connectionId: route.connectionId,
      modality: 'speech',
      callRole: 'generation',
    },
  );

  const inline = (response.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.inlineData)
    .filter(
      (data): data is { data: string; mimeType?: string } =>
        typeof data?.data === 'string',
    );
  if (!inline.length) {
    const reason =
      response.candidates?.[0]?.finishReason ?? 'no audio returned';
    throw new Error(`Speech model returned no audio (${reason})`);
  }

  const decoded = inline.map((data) =>
    decodeSpeechAudio(Buffer.from(data.data, 'base64'), data.mimeType),
  );
  const sampleRate = decoded[0].sampleRate;
  if (decoded.some((audio) => audio.sampleRate !== sampleRate)) {
    throw new Error('Speech model returned audio at mixed sample rates');
  }
  const total = decoded.reduce((sum, audio) => sum + audio.samples.length, 0);
  if (total === 0) {
    throw new Error('Speech model returned empty audio');
  }
  const samples = new Int16Array(total);
  let offset = 0;
  for (const audio of decoded) {
    samples.set(audio.samples, offset);
    offset += audio.samples.length;
  }
  return { samples, sampleRate };
}

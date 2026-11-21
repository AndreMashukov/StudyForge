import { Mp3Encoder } from '@breezystack/lamejs';

/** Mono 16-bit PCM audio. */
export interface IPcmAudio {
  samples: Int16Array;
  sampleRate: number;
}

const DEFAULT_SAMPLE_RATE = 24_000;
const MP3_FRAME_SAMPLES = 1152;
const MP3_SAMPLE_RATES = [
  8_000, 11_025, 12_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000,
];

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function toSamples(bytes: Uint8Array): Int16Array {
  const length = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, length * 2);
  const samples = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = view.getInt16(index * 2, true);
  }
  return samples;
}

function sampleRateFromMimeType(mimeType: string | undefined): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  const rate = match ? Number(match[1]) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_SAMPLE_RATE;
}

/** Reads a WAV file's sample rate and PCM data; accepts mono 16-bit audio only. */
function parseWav(bytes: Uint8Array): IPcmAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let channels = 1;
  let bitsPerSample = 16;
  while (offset + 8 <= bytes.byteLength) {
    const id = readAscii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (channels !== 1 || bitsPerSample !== 16) {
        throw new Error(
          `Unsupported speech audio: ${channels} channel(s), ${bitsPerSample}-bit`,
        );
      }
      const end = Math.min(bytes.byteLength, body + size);
      return { samples: toSamples(bytes.subarray(body, end)), sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('Speech audio WAV has no data chunk');
}

/**
 * Decodes speech model output: WAV, or headerless little-endian 16-bit PCM
 * (`audio/L16;codec=pcm;rate=24000`).
 */
export function decodeSpeechAudio(
  bytes: Uint8Array,
  mimeType?: string,
): IPcmAudio {
  if (
    bytes.byteLength >= 12 &&
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WAVE'
  ) {
    return parseWav(bytes);
  }
  if (mimeType && !/l16|pcm/i.test(mimeType)) {
    throw new Error(`Unsupported speech audio type: ${mimeType}`);
  }
  return {
    samples: toSamples(bytes),
    sampleRate: sampleRateFromMimeType(mimeType),
  };
}

export function pcmDurationMs(audio: IPcmAudio): number {
  return Math.round((audio.samples.length / audio.sampleRate) * 1000);
}

/** Encodes mono PCM as constant-bitrate MP3. */
export function encodeMp3(audio: IPcmAudio, kbps: number): Uint8Array {
  if (!MP3_SAMPLE_RATES.includes(audio.sampleRate)) {
    throw new Error(
      `MP3 cannot encode a sample rate of ${audio.sampleRate} Hz`,
    );
  }
  const encoder = new Mp3Encoder(1, audio.sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  for (
    let start = 0;
    start < audio.samples.length;
    start += MP3_FRAME_SAMPLES
  ) {
    const chunk = encoder.encodeBuffer(
      audio.samples.subarray(start, start + MP3_FRAME_SAMPLES),
    );
    if (chunk.length) chunks.push(chunk);
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(tail);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

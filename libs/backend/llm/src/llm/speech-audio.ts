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

/** Layer III bitrates in kbps by bitrate index: MPEG-1, then MPEG-2/2.5. */
const MP3_BITRATES_V1 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MP3_BITRATES_V2 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];
const MP3_RATES_V1 = [44_100, 48_000, 32_000];

/**
 * How long an MP3 stream plays: its frames times the samples per frame. The
 * encoder pads the start and end of each stream to whole frames, so this is a
 * little longer than the PCM it was made from, and it is what a decoder plays
 * when parts are joined. Stored durations use it, so positions in the joined
 * audio map to the right part. Counts Layer III frames and stops at anything
 * that is not one.
 */
export function mp3DurationMs(bytes: Uint8Array): number {
  let offset = 0;
  let samples = 0;
  let sampleRate = 0;
  while (offset + 4 <= bytes.length) {
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];
    if (bytes[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) break;
    const version = (b1 >> 3) & 0b11; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5
    const layer = (b1 >> 1) & 0b11; // 1: Layer III
    const bitrateIndex = b2 >> 4;
    const rateIndex = (b2 >> 2) & 0b11;
    const padding = (b2 >> 1) & 1;
    if (version === 1 || layer !== 1 || rateIndex === 3) break;
    const mpeg1 = version === 3;
    const kbps = (mpeg1 ? MP3_BITRATES_V1 : MP3_BITRATES_V2)[bitrateIndex];
    if (!kbps) break;
    const divisor = version === 3 ? 1 : version === 2 ? 2 : 4;
    sampleRate = MP3_RATES_V1[rateIndex] / divisor;
    const frameSamples = mpeg1 ? 1152 : 576;
    const frameBytes =
      Math.floor(((frameSamples / 8) * kbps * 1000) / sampleRate) + padding;
    samples += frameSamples;
    offset += frameBytes;
  }
  return sampleRate ? Math.round((samples / sampleRate) * 1000) : 0;
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

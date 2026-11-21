import { describe, expect, it } from 'vitest';
import { decodeSpeechAudio, encodeMp3, pcmDurationMs } from './speech-audio';

function sine(sampleRate: number, seconds: number): Int16Array {
  const samples = new Int16Array(Math.round(sampleRate * seconds));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.round(
      Math.sin((index / sampleRate) * 2 * Math.PI * 220) * 8000,
    );
  }
  return samples;
}

function pcmBytes(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
  return bytes;
}

function wav(samples: Int16Array, sampleRate: number): Uint8Array {
  const data = pcmBytes(samples);
  const bytes = new Uint8Array(44 + data.length);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(offset + index, char.charCodeAt(0)),
    );
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + data.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, data.length, true);
  bytes.set(data, 44);
  return bytes;
}

describe('decodeSpeechAudio', () => {
  it('reads raw L16 PCM with the rate from the mime type', () => {
    const samples = sine(16_000, 0.1);
    const audio = decodeSpeechAudio(
      pcmBytes(samples),
      'audio/L16;codec=pcm;rate=16000',
    );
    expect(audio.sampleRate).toBe(16_000);
    expect(Array.from(audio.samples)).toEqual(Array.from(samples));
  });

  it('reads WAV and ignores the header', () => {
    const samples = sine(24_000, 0.05);
    const audio = decodeSpeechAudio(wav(samples, 24_000), 'audio/wav');
    expect(audio.sampleRate).toBe(24_000);
    expect(audio.samples.length).toBe(samples.length);
    expect(pcmDurationMs(audio)).toBe(50);
  });

  it('rejects compressed formats it cannot decode', () => {
    expect(() => decodeSpeechAudio(new Uint8Array(10), 'audio/mpeg')).toThrow();
  });
});

describe('encodeMp3', () => {
  it('produces an MP3 near the requested bitrate', () => {
    const audio = { samples: sine(24_000, 2), sampleRate: 24_000 };
    const mp3 = encodeMp3(audio, 48);
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    const expectedBytes = (48_000 / 8) * 2;
    expect(mp3.length).toBeGreaterThan(expectedBytes * 0.8);
    expect(mp3.length).toBeLessThan(expectedBytes * 1.3);
  });
});

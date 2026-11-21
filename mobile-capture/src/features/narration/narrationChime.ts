/**
 * Builds the skip chime: two soft descending tones as a mono 16-bit WAV, so
 * no audio asset has to ship with the app.
 */
export function buildChimeWav(sampleRate = 22_050): Uint8Array {
  const tones = [
    { frequency: 880, seconds: 0.12 },
    { frequency: 660, seconds: 0.18 },
  ];
  const total = tones.reduce(
    (sum, tone) => sum + Math.round(tone.seconds * sampleRate),
    0,
  );
  const bytes = new Uint8Array(44 + total * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + total * 2, true);
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
  view.setUint32(40, total * 2, true);

  let offset = 44;
  for (const tone of tones) {
    const count = Math.round(tone.seconds * sampleRate);
    for (let index = 0; index < count; index += 1) {
      // Fade in and out so the tone does not click.
      const envelope = Math.min(1, index / 200, (count - index) / 600);
      const sample =
        Math.sin((2 * Math.PI * tone.frequency * index) / sampleRate) *
        0.25 *
        envelope;
      view.setInt16(offset, Math.round(sample * 32_767), true);
      offset += 2;
    }
  }
  return bytes;
}

import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { Slide } from '@shared-types';
import {
  buildSlideDeckZipFileName,
  buildSlideImageFileName,
  describeSlideImageExport,
  detectImageExtension,
  exportSingleSlideImage,
  exportSlideDeckImages,
  resolveSlideImageExtension,
  slugifyFileStem,
} from './slideDeckImageExport';

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const makeBlob = (bytes: number[], type = 'image/png') => new Blob([new Uint8Array(bytes)], { type });

const makeSlide = (id: string, title: string, imageStoragePath?: string): Slide => ({
  id,
  title,
  content: '',
  imageStoragePath,
});

describe('slugifyFileStem', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyFileStem('  Key Ideas: Part 1! ', 'slide')).toBe('key-ideas-part-1');
  });

  it('keeps non-Latin letters', () => {
    expect(slugifyFileStem('Введение в тему', 'slide')).toBe('введение-в-тему');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugifyFileStem('!!!', 'slide')).toBe('slide');
  });

  it('caps the length without a trailing hyphen', () => {
    const stem = slugifyFileStem(`${'a'.repeat(59)} bbbb`, 'slide');
    expect(stem).toBe('a'.repeat(59));
  });
});

describe('buildSlideImageFileName', () => {
  it('pads to two digits by default', () => {
    expect(buildSlideImageFileName(0, 'Intro', 'png', 12)).toBe('01-intro.png');
  });

  it('pads to the width of the slide count', () => {
    expect(buildSlideImageFileName(4, 'Intro', 'jpg', 120)).toBe('005-intro.jpg');
  });

  it('names the zip after the slide deck', () => {
    expect(buildSlideDeckZipFileName('Cloud Run Basics')).toBe('cloud-run-basics.zip');
    expect(buildSlideDeckZipFileName('')).toBe('slide-deck.zip');
  });
});

describe('image extension resolution', () => {
  it('sniffs magic bytes', () => {
    expect(detectImageExtension(new Uint8Array(PNG_BYTES))).toBe('png');
    expect(detectImageExtension(new Uint8Array(JPEG_BYTES))).toBe('jpg');
    expect(detectImageExtension(new Uint8Array(WEBP_BYTES))).toBe('webp');
    expect(detectImageExtension(new Uint8Array([0x00, 0x01]))).toBeNull();
  });

  it('prefers bytes over a wrong content type', () => {
    expect(
      resolveSlideImageExtension({
        bytes: new Uint8Array(JPEG_BYTES),
        contentType: 'image/png',
        storagePath: 'a/slide-0.png',
      })
    ).toBe('jpg');
  });

  it('falls back to content type, then path, then png', () => {
    const unknown = new Uint8Array([0x00]);
    expect(resolveSlideImageExtension({ bytes: unknown, contentType: 'image/webp', storagePath: 'x' })).toBe('webp');
    expect(resolveSlideImageExtension({ bytes: unknown, contentType: '', storagePath: 'a/slide-1.jpeg' })).toBe('jpg');
    expect(resolveSlideImageExtension({ bytes: unknown, contentType: '', storagePath: 'a/slide-1' })).toBe('png');
  });
});

describe('exportSlideDeckImages', () => {
  it('zips images in slide order, skips missing images and reports failures', async () => {
    const slides = [
      makeSlide('a', 'Intro', 'p/a.png'),
      makeSlide('b', 'No Image'),
      makeSlide('c', 'Broken', 'p/c.png'),
      makeSlide('d', 'Outro', 'p/d.jpg'),
    ];
    const fetchBlob = vi.fn(async (path: string) => {
      if (path === 'p/c.png') throw new Error('network');
      return path.endsWith('.jpg') ? makeBlob(JPEG_BYTES, 'image/jpeg') : makeBlob(PNG_BYTES);
    });
    const onProgress = vi.fn();

    const result = await exportSlideDeckImages({ title: 'My Deck', slides }, { fetchBlob, onProgress });

    expect(result.fileName).toBe('my-deck.zip');
    expect(result.downloaded).toBe(2);
    expect(result.skippedNoImage).toBe(1);
    expect(result.failedSlideNumbers).toEqual([3]);
    // One retry for the failing image.
    expect(fetchBlob.mock.calls.filter(([path]) => path === 'p/c.png')).toHaveLength(2);
    expect(onProgress).toHaveBeenLastCalledWith({ done: 3, total: 3 });

    expect(result.blob).not.toBeNull();
    if (!result.blob) return;
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['01-intro.png', '04-outro.jpg']);
  });

  it('succeeds on retry', async () => {
    let calls = 0;
    const fetchBlob = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('blip');
      return makeBlob(PNG_BYTES);
    });

    const result = await exportSlideDeckImages(
      { title: 'Deck', slides: [makeSlide('a', 'One', 'p/a.png')] },
      { fetchBlob }
    );

    expect(result.downloaded).toBe(1);
    expect(result.failedSlideNumbers).toEqual([]);
  });

  it('returns no blob when nothing could be fetched', async () => {
    const result = await exportSlideDeckImages(
      { title: 'Deck', slides: [makeSlide('a', 'One')] },
      { fetchBlob: vi.fn() }
    );

    expect(result.blob).toBeNull();
    expect(result.downloaded).toBe(0);
    expect(result.skippedNoImage).toBe(1);
  });
});

describe('exportSingleSlideImage', () => {
  it('names the file by position and real format', async () => {
    const file = await exportSingleSlideImage(
      makeSlide('a', 'Key Ideas', 'p/a.png'),
      1,
      8,
      async () => makeBlob(JPEG_BYTES, 'image/png')
    );

    expect(file?.fileName).toBe('02-key-ideas.jpg');
    expect(file?.blob.type).toBe('image/jpeg');
  });

  it('returns null for a slide without an image', async () => {
    expect(await exportSingleSlideImage(makeSlide('a', 'x'), 0, 1, vi.fn())).toBeNull();
  });
});

describe('describeSlideImageExport', () => {
  it('reports a clean success', () => {
    expect(describeSlideImageExport({ downloaded: 12, skippedNoImage: 0, failedSlideNumbers: [] })).toEqual({
      variant: 'success',
      message: 'Downloaded 12 images',
    });
  });

  it('mentions slides without images', () => {
    expect(describeSlideImageExport({ downloaded: 11, skippedNoImage: 1, failedSlideNumbers: [] }).message).toBe(
      'Downloaded 11 images · 1 slide had no image'
    );
  });

  it('warns about failed slides', () => {
    expect(describeSlideImageExport({ downloaded: 10, skippedNoImage: 0, failedSlideNumbers: [4, 9] })).toEqual({
      variant: 'warning',
      message: 'Downloaded 10 of 12 images · slides 4, 9 failed',
    });
  });

  it('errors when nothing was downloaded', () => {
    expect(describeSlideImageExport({ downloaded: 0, skippedNoImage: 0, failedSlideNumbers: [1] }).variant).toBe('error');
    expect(describeSlideImageExport({ downloaded: 0, skippedNoImage: 3, failedSlideNumbers: [] }).message).toBe(
      'This slide deck has no images to download.'
    );
  });
});

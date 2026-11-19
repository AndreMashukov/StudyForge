import type { Slide, SlideDeck } from '@shared-types';

export type SlideImageExtension = 'png' | 'jpg' | 'webp' | 'gif';

export type FetchSlideImageBlob = (storagePath: string) => Promise<Blob>;

export interface ISlideImageExportProgress {
  done: number;
  total: number;
}

export interface ISlideImageExportResult {
  /** `null` when no image could be fetched — nothing to download. */
  blob: Blob | null;
  fileName: string;
  downloaded: number;
  skippedNoImage: number;
  /** 1-based slide numbers whose image failed to fetch after a retry. */
  failedSlideNumbers: number[];
}

export interface ISlideImageExportSummary {
  variant: 'success' | 'warning' | 'error';
  message: string;
}

export interface IPreparedSlideImage {
  fileName: string;
  extension: SlideImageExtension;
  bytes: ArrayBuffer;
}

interface IExportSlideDeckImagesOptions {
  fetchBlob: FetchSlideImageBlob;
  onProgress?: (progress: ISlideImageExportProgress) => void;
  concurrency?: number;
}

const MAX_SLUG_LENGTH = 60;
const DEFAULT_CONCURRENCY = 4;
const FETCH_ATTEMPTS = 2;

const CONTENT_TYPE_EXTENSIONS = new Map<string, SlideImageExtension>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const PATH_EXTENSIONS = new Map<string, SlideImageExtension>([
  ['png', 'png'],
  ['jpg', 'jpg'],
  ['jpeg', 'jpg'],
  ['webp', 'webp'],
  ['gif', 'gif'],
]);

export const SLIDE_IMAGE_MIME_TYPES: Record<SlideImageExtension, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Lowercase, hyphen-separated file stem. Keeps Unicode letters so non-Latin titles survive. */
export const slugifyFileStem = (value: string, fallback: string): string => {
  const slug = value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = Array.from(slug).slice(0, MAX_SLUG_LENGTH).join('').replace(/-+$/g, '');
  return truncated || fallback;
};

/** `01-intro.png` — number is the slide position, padded to the width of the slide count (min 2). */
export const buildSlideImageFileName = (
  index: number,
  title: string,
  extension: SlideImageExtension,
  total: number
): string => {
  const width = Math.max(2, String(Math.max(total, 1)).length);
  const number = String(index + 1).padStart(width, '0');
  return `${number}-${slugifyFileStem(title, 'slide')}.${extension}`;
};

export const buildSlideDeckZipFileName = (deckTitle: string): string =>
  `${slugifyFileStem(deckTitle, 'slide-deck')}.zip`;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, i) => bytes[offset + i] === byte);

/** Sniffs the real image format — generated slides are stored as `image/png` regardless of bytes. */
export const detectImageExtension = (bytes: Uint8Array): SlideImageExtension | null => {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
};

export const resolveSlideImageExtension = ({
  bytes,
  contentType,
  storagePath,
}: {
  bytes: Uint8Array;
  contentType: string;
  storagePath: string;
}): SlideImageExtension => {
  const fromBytes = detectImageExtension(bytes);
  if (fromBytes) return fromBytes;

  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const fromContentType = CONTENT_TYPE_EXTENSIONS.get(mime);
  if (fromContentType) return fromContentType;

  const pathExtension = storagePath.includes('.')
    ? storagePath.slice(storagePath.lastIndexOf('.') + 1).toLowerCase()
    : '';
  return PATH_EXTENSIONS.get(pathExtension) ?? 'png';
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  attempts = FETCH_ATTEMPTS
): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Operation failed');
};

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
};

export const prepareSlideImage = async ({
  blob,
  storagePath,
  index,
  title,
  total,
}: {
  blob: Blob;
  storagePath: string;
  index: number;
  title: string;
  total: number;
}): Promise<IPreparedSlideImage> => {
  const bytes = await blob.arrayBuffer();
  const extension = resolveSlideImageExtension({
    bytes: new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)),
    contentType: blob.type,
    storagePath,
  });
  return {
    bytes,
    extension,
    fileName: buildSlideImageFileName(index, title, extension, total),
  };
};

/**
 * Fetches every slide image (with one retry each) and zips them in slide order.
 * Slides without an image are skipped; failed fetches are reported, not fatal.
 */
export const exportSlideDeckImages = async (
  deck: Pick<SlideDeck, 'title' | 'slides'>,
  { fetchBlob, onProgress, concurrency = DEFAULT_CONCURRENCY }: IExportSlideDeckImagesOptions
): Promise<ISlideImageExportResult> => {
  const slides = deck.slides ?? [];
  const total = slides.length;
  const targets = slides.flatMap((slide, index) =>
    slide.imageStoragePath ? [{ index, title: slide.title, storagePath: slide.imageStoragePath }] : []
  );

  const prepared: Array<IPreparedSlideImage & { index: number }> = [];
  const failedSlideNumbers: number[] = [];
  let done = 0;
  onProgress?.({ done, total: targets.length });

  await runWithConcurrency(targets, concurrency, async (target) => {
    try {
      const blob = await withRetry(() => fetchBlob(target.storagePath));
      const image = await prepareSlideImage({ blob, total, ...target });
      prepared.push({ ...image, index: target.index });
    } catch {
      failedSlideNumbers.push(target.index + 1);
    }
    done += 1;
    onProgress?.({ done, total: targets.length });
  });

  failedSlideNumbers.sort((a, b) => a - b);
  const fileName = buildSlideDeckZipFileName(deck.title);
  const summary = {
    fileName,
    downloaded: prepared.length,
    skippedNoImage: total - targets.length,
    failedSlideNumbers,
  };

  if (prepared.length === 0) {
    return { ...summary, blob: null };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  prepared
    .sort((a, b) => a.index - b.index)
    .forEach((image) => zip.file(image.fileName, image.bytes));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
    mimeType: 'application/zip',
  });

  return { ...summary, blob };
};

/** Fetches a single slide image ready for download, or `null` when the slide has no image. */
export const exportSingleSlideImage = async (
  slide: Slide,
  index: number,
  total: number,
  fetchBlob: FetchSlideImageBlob
): Promise<{ blob: Blob; fileName: string } | null> => {
  const storagePath = slide.imageStoragePath;
  if (!storagePath) return null;

  const source = await withRetry(() => fetchBlob(storagePath));
  const image = await prepareSlideImage({
    blob: source,
    storagePath,
    index,
    title: slide.title,
    total,
  });

  return {
    fileName: image.fileName,
    blob: new Blob([image.bytes], { type: SLIDE_IMAGE_MIME_TYPES[image.extension] }),
  };
};

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

export const describeSlideImageExport = ({
  downloaded,
  skippedNoImage,
  failedSlideNumbers,
}: Pick<
  ISlideImageExportResult,
  'downloaded' | 'skippedNoImage' | 'failedSlideNumbers'
>): ISlideImageExportSummary => {
  const failedCount = failedSlideNumbers.length;

  if (downloaded === 0) {
    return {
      variant: 'error',
      message:
        failedCount > 0
          ? "Couldn't download the slide images. Please try again."
          : 'This slide deck has no images to download.',
    };
  }

  const parts = [
    failedCount > 0
      ? `Downloaded ${downloaded} of ${downloaded + failedCount} images`
      : `Downloaded ${pluralize(downloaded, 'image')}`,
  ];
  if (skippedNoImage > 0) {
    parts.push(`${pluralize(skippedNoImage, 'slide')} had no image`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount === 1 ? 'slide' : 'slides'} ${failedSlideNumbers.join(', ')} failed`);
  }

  return {
    variant: failedCount > 0 ? 'warning' : 'success',
    message: parts.join(' · '),
  };
};

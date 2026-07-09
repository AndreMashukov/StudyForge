import type { Slide, SlideDeck } from '@shared-types';
import { storage, useEmulator } from '../config/firebase';

const STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

function getStorageBucketName(): string | undefined {
  return storage.app.options.storageBucket;
}

/** Build a Firebase Storage download URL from path + token (mirrors getSlideDeck callable). */
export function resolveSlideImageUrl(slide: Slide): string | undefined {
  if (slide.imageUrl) {
    return slide.imageUrl;
  }
  if (!slide.imageStoragePath) {
    return undefined;
  }

  const bucket = getStorageBucketName();
  if (!bucket) {
    return undefined;
  }

  const encodedPath = encodeURIComponent(slide.imageStoragePath);

  if (useEmulator) {
    const token = slide.imageDownloadToken ? `&token=${slide.imageDownloadToken}` : '';
    return `http://${STORAGE_EMULATOR_HOST}/v0/b/${bucket}/o/${encodedPath}?alt=media${token}`;
  }

  if (slide.imageDownloadToken) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${slide.imageDownloadToken}`;
  }

  return undefined;
}

/** Attach imageUrl to slides when Firestore only stored path + download token. */
export function resolveSlideDeckImageUrls(slideDeck: SlideDeck): SlideDeck {
  if (!slideDeck.slides?.length) {
    return slideDeck;
  }

  let changed = false;
  const slides = slideDeck.slides.map((slide) => {
    if (slide.imageUrl) {
      return slide;
    }
    const imageUrl = resolveSlideImageUrl(slide);
    if (!imageUrl) {
      return slide;
    }
    changed = true;
    return { ...slide, imageUrl };
  });

  return changed ? { ...slideDeck, slides } : slideDeck;
}

import { getBlob, ref } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Reads a slide image through the Storage SDK (owner-only rule, works with or without a
 * download token, and talks to the emulator in dev). Requires bucket CORS for GET.
 */
export const fetchSlideImageBlob = (storagePath: string): Promise<Blob> =>
  getBlob(ref(storage, storagePath));

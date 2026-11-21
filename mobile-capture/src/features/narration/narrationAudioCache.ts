import { Directory, File, Paths } from 'expo-file-system';
import { getDownloadURL, ref } from 'firebase/storage';
import type { NarrationPart } from '@shared-types';
import { storage } from '../../lib/firebase';
import { buildChimeWav } from './narrationChime';

/**
 * Narration parts are kept on the device once downloaded, so a looping
 * narration replays from the phone instead of downloading every pass.
 */

function narrationDirectory(documentId: string): Directory {
  const directory = new Directory(Paths.cache, 'narration', documentId);
  if (!directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/** A local file for a part's audio, downloading it the first time. */
export async function cachedNarrationPartUri(
  documentId: string,
  part: NarrationPart,
): Promise<string> {
  if (!part.storagePath) throw new Error('This part has no audio yet.');
  const file = new File(narrationDirectory(documentId), `${part.key}.mp3`);
  if (file.exists && (file.size ?? 0) > 0) return file.uri;
  const url = await getDownloadURL(ref(storage, part.storagePath));
  const downloaded = await File.downloadFileAsync(url, file, {
    idempotent: true,
  });
  return downloaded.uri;
}

/** Deletes a document's downloaded parts, e.g. after its narration was removed. */
export function clearCachedNarration(documentId: string): void {
  const directory = new Directory(Paths.cache, 'narration', documentId);
  if (directory.exists) directory.delete();
}

/** Deletes downloaded parts the narration no longer has. */
export function pruneCachedNarration(
  documentId: string,
  keepKeys: string[],
): void {
  const directory = new Directory(Paths.cache, 'narration', documentId);
  if (!directory.exists) return;
  const keep = new Set(keepKeys.map((key) => `${key}.mp3`));
  for (const entry of directory.list()) {
    if (entry instanceof File && !keep.has(entry.name)) entry.delete();
  }
}

let chimeUri: string | null = null;

/** The short tone played where a part could not be generated. */
export function narrationChimeUri(): string {
  if (chimeUri) return chimeUri;
  const directory = new Directory(Paths.cache, 'narration');
  if (!directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, 'skip-chime.wav');
  if (!file.exists) file.write(buildChimeWav());
  chimeUri = file.uri;
  return chimeUri;
}

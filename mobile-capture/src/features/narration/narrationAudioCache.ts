import { Directory, File, Paths } from 'expo-file-system';
import { getDownloadURL, ref } from 'firebase/storage';
import type { NarrationPart } from '@shared-types';
import { storage } from '../../lib/firebase';

/**
 * Narration parts are kept on the device once downloaded, so replaying does
 * not download again. To play, the parts are joined into one local file (see
 * `combinedNarrationUri`).
 */

const COMBINED_PREFIX = 'combined-';

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

/** A short stable name for a list of part keys. */
function hashKeys(keys: string[]): string {
  let hash = 5381;
  for (const char of keys.join(',')) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
}

/**
 * One local file with all these parts joined in order. The parts are
 * constant-bitrate MP3 from one encoder, so joining their bytes gives a valid
 * MP3. Playing one file means nothing has to switch audio at a part boundary,
 * which is what lets it keep playing with the app in the background or the
 * phone locked. Reused while the set of parts is unchanged.
 */
export async function combinedNarrationUri(
  documentId: string,
  parts: NarrationPart[],
): Promise<string> {
  const directory = narrationDirectory(documentId);
  const name = `${COMBINED_PREFIX}${hashKeys(parts.map((part) => part.key))}.mp3`;
  const combined = new File(directory, name);
  if (combined.exists && (combined.size ?? 0) > 0) return combined.uri;

  const uris = await Promise.all(
    parts.map((part) => cachedNarrationPartUri(documentId, part)),
  );
  const chunks = await Promise.all(uris.map((uri) => new File(uri).bytes()));
  const joined = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  combined.write(joined);

  // Older joined files are no longer needed; a player still holding one keeps reading it.
  for (const entry of directory.list()) {
    if (
      entry instanceof File &&
      entry.name.startsWith(COMBINED_PREFIX) &&
      entry.name !== name
    ) {
      entry.delete();
    }
  }
  return combined.uri;
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
    if (
      entry instanceof File &&
      !entry.name.startsWith(COMBINED_PREFIX) &&
      !keep.has(entry.name)
    ) {
      entry.delete();
    }
  }
}

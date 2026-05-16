import path from 'path';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import { SupportedFileExtension } from '@shared-types';
import { FileExtractionError } from './types';

export const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_MARKDOWN_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1000;
const MAX_ZIP_TEXT_ENTRY_BYTES = 5 * 1024 * 1024;

export interface SupportedFileTypeConfig {
  extension: SupportedFileExtension;
  displayName: string;
  mimeTypes: string[];
}

export const SUPPORTED_FILE_TYPES: Record<SupportedFileExtension, SupportedFileTypeConfig> = {
  pdf: {
    extension: 'pdf',
    displayName: 'PDF',
    mimeTypes: ['application/pdf'],
  },
  docx: {
    extension: 'docx',
    displayName: 'DOCX',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
  txt: {
    extension: 'txt',
    displayName: 'TXT',
    mimeTypes: ['text/plain'],
  },
  md: {
    extension: 'md',
    displayName: 'Markdown',
    mimeTypes: ['text/markdown', 'text/x-markdown', 'text/plain'],
  },
  csv: {
    extension: 'csv',
    displayName: 'CSV',
    mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  },
  pptx: {
    extension: 'pptx',
    displayName: 'PPTX',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  },
  epub: {
    extension: 'epub',
    displayName: 'EPUB',
    mimeTypes: ['application/epub+zip'],
  },
};

export function getSupportedFileExtensions(): string[] {
  return Object.keys(SUPPORTED_FILE_TYPES).map((extension) => `.${extension}`);
}

export function getSupportedMimeTypes(): string[] {
  return Object.values(SUPPORTED_FILE_TYPES).flatMap((config) => config.mimeTypes);
}

export function getFileExtension(filename: string): SupportedFileExtension {
  validateSafeFilename(filename);

  const trimmed = filename.trim();
  const lastDotIndex = trimmed.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === trimmed.length - 1) {
    throw new FileExtractionError('File must include a supported extension.');
  }

  const extension = trimmed.substring(lastDotIndex + 1).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_FILE_TYPES, extension)) {
    throw new FileExtractionError(`Unsupported file type: .${extension}`);
  }

  return extension as SupportedFileExtension;
}

export function validateSafeFilename(filename: string): void {
  const trimmed = filename.trim();
  if (!trimmed) {
    throw new FileExtractionError('Filename is required.');
  }

  if (/[\\/]/.test(trimmed) || containsDisallowedControlCharacter(trimmed)) {
    throw new FileExtractionError('Filename contains unsupported characters.');
  }

  const basename = trimmed.replace(/\.[^.]+$/, '');
  if (!basename || basename === '.' || basename === '..') {
    throw new FileExtractionError('Filename must include a non-empty basename.');
  }
}

export function validateBrowserMimeType(extension: SupportedFileExtension, mimeType?: string): void {
  if (!mimeType) {
    return;
  }

  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
  if (!normalizedMime || normalizedMime === 'application/octet-stream') {
    return;
  }

  const config = SUPPORTED_FILE_TYPES[extension];
  const zipFallbacks = ['application/zip', 'application/x-zip-compressed'];
  const allowedMimeTypes = isZipBasedExtension(extension)
    ? [...config.mimeTypes, ...zipFallbacks]
    : config.mimeTypes;

  if (!allowedMimeTypes.includes(normalizedMime)) {
    throw new FileExtractionError(
      `MIME type ${mimeType} does not match .${extension} uploads.`
    );
  }
}

export function isZipBasedExtension(extension: SupportedFileExtension): boolean {
  return extension === 'docx' || extension === 'pptx' || extension === 'epub';
}

export function decodeUtf8(buffer: Buffer): string {
  return stripBom(buffer.toString('utf8'));
}

export function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export function countWords(content: string): number {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.split(' ').length : 0;
}

export function filenameToTitle(filename: string): string {
  return filename
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled Document';
}

export function extractMarkdownTitle(content: string): string | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch?.[1]?.trim() || null;
}

export function assertExtractedMarkdown(content: string, filename: string): void {
  if (!content || content.trim().length === 0) {
    throw new FileExtractionError(`No content could be extracted from ${filename}.`);
  }

  const byteLength = Buffer.byteLength(content, 'utf8');
  if (byteLength > MAX_EXTRACTED_MARKDOWN_BYTES) {
    throw new FileExtractionError(
      `Extracted content is too large: ${formatBytes(byteLength)}, maximum is ${formatBytes(MAX_EXTRACTED_MARKDOWN_BYTES)}.`
    );
  }
}

export function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)}MB`;
  }
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  turndownService.addRule('omittedImages', {
    filter: 'img',
    replacement: () => '\n\n_[Image omitted from original document]_\n\n',
  });

  return turndownService;
}

export async function loadZipSafely(buffer: Buffer, filename: string): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new FileExtractionError(`Failed to read ZIP container for ${filename}.`);
  }

  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new FileExtractionError(
      `Archive contains too many files: ${entries.length}, maximum is ${MAX_ZIP_ENTRIES}.`
    );
  }

  for (const entry of entries) {
    const unsafeOriginalName = (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName;
    if (isUnsafeZipPath(entry.name) || (unsafeOriginalName && isUnsafeZipPath(unsafeOriginalName))) {
      throw new FileExtractionError(`Archive contains an unsafe path: ${entry.name}`);
    }
  }

  return zip;
}

export async function readZipText(
  zip: JSZip,
  entryPath: string,
  maxBytes = MAX_ZIP_TEXT_ENTRY_BYTES
): Promise<string | null> {
  const entry = zip.file(entryPath);
  if (!entry) {
    return null;
  }

  const text = await entry.async('string');
  const byteLength = Buffer.byteLength(text, 'utf8');
  if (byteLength > maxBytes) {
    throw new FileExtractionError(`Archive entry is too large: ${entryPath}`);
  }

  return text;
}

export async function readRequiredZipText(zip: JSZip, entryPath: string): Promise<string> {
  const text = await readZipText(zip, entryPath);
  if (text === null) {
    throw new FileExtractionError(`Archive is missing required entry: ${entryPath}`);
  }
  return text;
}

export function resolveZipPath(baseFilePath: string, relativePath: string): string {
  const baseDirectory = path.posix.dirname(baseFilePath);
  const resolved = path.posix.normalize(path.posix.join(baseDirectory, relativePath));
  if (isUnsafeZipPath(resolved)) {
    throw new FileExtractionError(`Archive contains an unsafe reference: ${relativePath}`);
  }
  return resolved;
}

export function collectTextByXmlTag(value: unknown, targetTags: Set<string>): string[] {
  const textValues: string[] = [];

  function visit(current: unknown): void {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof current === 'string' || typeof current === 'number') {
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    if (typeof current !== 'object') {
      return;
    }

    const record = current as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (targetTags.has(key)) {
        if (typeof child === 'string' || typeof child === 'number') {
          textValues.push(String(child));
        } else if (Array.isArray(child)) {
          child.forEach((item) => {
            if (typeof item === 'string' || typeof item === 'number') {
              textValues.push(String(item));
            } else if (item && typeof item === 'object') {
              const text = (item as Record<string, unknown>)['#text'];
              if (typeof text === 'string' || typeof text === 'number') {
                textValues.push(String(text));
              }
              visit(item);
            }
          });
        } else {
          visit(child);
        }
      } else {
        visit(child);
      }
    }
  }

  visit(value);
  return textValues.map((text) => text.trim()).filter(Boolean);
}

function isUnsafeZipPath(entryPath: string): boolean {
  const normalized = path.posix.normalize(entryPath.replace(/\\/g, '/'));
  return (
    normalized.startsWith('../') ||
    normalized === '..' ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:/.test(normalized) ||
    containsDisallowedControlCharacter(entryPath)
  );
}

function containsDisallowedControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);
    if (charCode <= 0x1f || charCode === 0x7f) {
      return true;
    }
  }

  return false;
}

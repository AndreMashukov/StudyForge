import { XMLParser } from 'fast-xml-parser';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionError, FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  createTurndownService,
  filenameToTitle,
  loadZipSafely,
  readRequiredZipText,
  readZipText,
  resolveZipPath,
} from '../utils';

export class EpubExtractor implements FileExtractor {
  readonly name = 'EpubExtractor';
  readonly supportedExtensions = ['epub'] as const;
  readonly supportedMimeTypes = ['application/epub+zip'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    const zip = await loadZipSafely(input.buffer, input.filename);
    const mimetype = await readRequiredZipText(zip, 'mimetype');
    if (mimetype.trim() !== 'application/epub+zip') {
      throw new FileExtractionError('The uploaded file is not a valid EPUB file.');
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const containerXml = await readRequiredZipText(zip, 'META-INF/container.xml');
    const rootFilePath = this.getRootFilePath(parser.parse(containerXml));
    const packageXml = await readRequiredZipText(zip, rootFilePath);
    const packageDocument = parser.parse(packageXml);
    const title = this.getPackageTitle(packageDocument) || filenameToTitle(input.filename);
    const manifest = this.getManifest(packageDocument);
    const spineIds = this.getSpineIds(packageDocument);

    if (spineIds.length === 0) {
      throw new FileExtractionError('EPUB spine does not contain readable chapters.');
    }

    const turndownService = createTurndownService();
    const warnings: string[] = [];
    const chapterSections: string[] = [];

    for (const idRef of spineIds) {
      const manifestItem = manifest.get(idRef);
      if (!manifestItem) {
        warnings.push(`EPUB spine item is missing from manifest: ${idRef}`);
        continue;
      }

      if (!isHtmlMediaType(manifestItem.mediaType)) {
        continue;
      }

      const chapterPath = resolveZipPath(rootFilePath, manifestItem.href);
      const chapterHtml = await readZipText(zip, chapterPath);
      if (!chapterHtml) {
        warnings.push(`EPUB chapter is missing: ${chapterPath}`);
        continue;
      }

      const chapterMarkdown = turndownService.turndown(chapterHtml).trim();
      if (chapterMarkdown) {
        chapterSections.push(chapterMarkdown);
      }
    }

    const markdownContent = [`# ${title}`, '', ...chapterSections].join('\n\n').trim();
    assertExtractedMarkdown(markdownContent, input.filename);

    return {
      filename: input.filename,
      originalType: input.mimeType || 'application/epub+zip',
      markdownContent,
      wordCount: countWords(markdownContent),
      title,
      extension: 'epub',
      originalSize: input.buffer.length,
      warnings: warnings.length ? warnings : undefined,
      metadata: {
        chapterCount: chapterSections.length,
      },
    };
  }

  private getRootFilePath(containerDocument: unknown): string {
    const container = (containerDocument as { container?: { rootfiles?: { rootfile?: unknown } } }).container;
    const rootfile = container?.rootfiles?.rootfile;
    const rootfiles = Array.isArray(rootfile) ? rootfile : [rootfile];
    const fullPath = rootfiles
      .map((item) => (item as Record<string, unknown> | undefined)?.['@_full-path'])
      .find((value): value is string => typeof value === 'string' && value.length > 0);

    if (!fullPath) {
      throw new FileExtractionError('EPUB container is missing the root package file.');
    }

    return fullPath;
  }

  private getPackageTitle(packageDocument: unknown): string | null {
    const metadata = (packageDocument as { package?: { metadata?: Record<string, unknown> } }).package?.metadata;
    const title = metadata?.['dc:title'];
    if (typeof title === 'string') {
      return title.trim() || null;
    }
    if (Array.isArray(title)) {
      const firstTitle = title.find((value) => typeof value === 'string' && value.trim());
      return typeof firstTitle === 'string' ? firstTitle.trim() : null;
    }
    return null;
  }

  private getManifest(packageDocument: unknown): Map<string, { href: string; mediaType: string }> {
    const items = (packageDocument as { package?: { manifest?: { item?: unknown } } }).package?.manifest?.item;
    const manifestItems = Array.isArray(items) ? items : [items];
    const manifest = new Map<string, { href: string; mediaType: string }>();

    for (const item of manifestItems) {
      const record = item as Record<string, unknown> | undefined;
      const id = record?.['@_id'];
      const href = record?.['@_href'];
      const mediaType = record?.['@_media-type'];
      if (typeof id === 'string' && typeof href === 'string' && typeof mediaType === 'string') {
        manifest.set(id, { href, mediaType });
      }
    }

    return manifest;
  }

  private getSpineIds(packageDocument: unknown): string[] {
    const itemRefs = (packageDocument as { package?: { spine?: { itemref?: unknown } } }).package?.spine?.itemref;
    const spineItems = Array.isArray(itemRefs) ? itemRefs : [itemRefs];
    return spineItems
      .map((item) => (item as Record<string, unknown> | undefined)?.['@_idref'])
      .filter((idRef): idRef is string => typeof idRef === 'string' && idRef.length > 0);
  }
}

function isHtmlMediaType(mediaType: string): boolean {
  return mediaType === 'application/xhtml+xml' || mediaType === 'text/html';
}

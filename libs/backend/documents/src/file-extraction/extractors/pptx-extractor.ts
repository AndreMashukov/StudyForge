import { XMLParser } from 'fast-xml-parser';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionError, FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  collectTextByXmlTag,
  countWords,
  filenameToTitle,
  loadZipSafely,
  readRequiredZipText,
  readZipText,
} from '../utils';

const SLIDE_TEXT_TAGS = new Set(['a:t']);

export class PptxExtractor implements FileExtractor {
  readonly name = 'PptxExtractor';
  readonly supportedExtensions = ['pptx'] as const;
  readonly supportedMimeTypes = ['application/vnd.openxmlformats-officedocument.presentationml.presentation'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    const zip = await loadZipSafely(input.buffer, input.filename);
    const contentTypesXml = await readRequiredZipText(zip, '[Content_Types].xml');
    if (!contentTypesXml.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')) {
      throw new FileExtractionError('The uploaded file is not a valid PPTX presentation.');
    }

    const slideEntries = Object.keys(zip.files)
      .map((entryPath) => {
        const match = entryPath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        return match ? { entryPath, slideNumber: Number(match[1]) } : null;
      })
      .filter((entry): entry is { entryPath: string; slideNumber: number } => entry !== null)
      .sort((left, right) => left.slideNumber - right.slideNumber);

    if (slideEntries.length === 0) {
      throw new FileExtractionError('No slides were found in this PPTX file.');
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const warnings: string[] = [];
    const slideSections: string[] = [];

    for (const slideEntry of slideEntries) {
      const slideXml = await readRequiredZipText(zip, slideEntry.entryPath);
      const slideText = this.extractTextFromXml(parser, slideXml);
      const notesXml = await readZipText(zip, `ppt/notesSlides/notesSlide${slideEntry.slideNumber}.xml`);
      const notesText = notesXml ? this.extractTextFromXml(parser, notesXml) : [];

      if (slideText.length === 0 && notesText.length === 0) {
        warnings.push(`Slide ${slideEntry.slideNumber} did not contain extractable text.`);
        continue;
      }

      const slideTitle = slideText[0] || `Slide ${slideEntry.slideNumber}`;
      const bodyText = slideText.slice(1);
      const lines = [
        `## Slide ${slideEntry.slideNumber}: ${slideTitle}`,
        '',
        ...bodyText.map((text) => `- ${text}`),
      ];

      if (notesText.length > 0) {
        lines.push('', '### Speaker Notes', '', ...notesText.map((text) => `- ${text}`));
      }

      slideSections.push(lines.join('\n').trim());
    }

    const title = filenameToTitle(input.filename);
    const markdownContent = [`# ${title}`, '', ...slideSections].join('\n\n').trim();
    assertExtractedMarkdown(markdownContent, input.filename);

    return {
      filename: input.filename,
      originalType: input.mimeType || this.supportedMimeTypes[0],
      markdownContent,
      wordCount: countWords(markdownContent),
      title,
      extension: 'pptx',
      originalSize: input.buffer.length,
      warnings: warnings.length ? warnings : undefined,
      metadata: {
        pageCount: slideEntries.length,
        slideCount: slideEntries.length,
      },
    };
  }

  private extractTextFromXml(parser: XMLParser, xml: string): string[] {
    const parsed = parser.parse(xml);
    return dedupeConsecutiveText(collectTextByXmlTag(parsed, SLIDE_TEXT_TAGS));
  }
}

function dedupeConsecutiveText(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (result[result.length - 1] !== value) {
      result.push(value);
    }
  }
  return result;
}

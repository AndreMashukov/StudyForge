import { SupportedFileExtension } from '@shared-types';
import { CsvExtractor } from './extractors/csv-extractor';
import { DocxExtractor } from './extractors/docx-extractor';
import { EpubExtractor } from './extractors/epub-extractor';
import { MarkdownExtractor } from './extractors/markdown-extractor';
import { PdfExtractor } from './extractors/pdf-extractor';
import { PptxExtractor } from './extractors/pptx-extractor';
import { TextExtractor } from './extractors/text-extractor';
import { FileExtractionError, FileExtractor } from './types';

const EXTRACTION_REGISTRY: FileExtractor[] = [
  new PdfExtractor(),
  new DocxExtractor(),
  new PptxExtractor(),
  new CsvExtractor(),
  new EpubExtractor(),
  new MarkdownExtractor(),
  new TextExtractor(),
];

export class FileExtractionRegistry {
  static select(extension: SupportedFileExtension): FileExtractor {
    const extractor = EXTRACTION_REGISTRY.find((candidate) =>
      candidate.supportedExtensions.includes(extension)
    );

    if (!extractor) {
      throw new FileExtractionError(`No extractor registered for .${extension} files.`);
    }

    return extractor;
  }

  static listExtractors(): FileExtractor[] {
    return [...EXTRACTION_REGISTRY];
  }
}

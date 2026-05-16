import Papa from 'papaparse';
import { FileExtractionResult } from '@shared-types';
import { FileExtractionError, FileExtractionInput, FileExtractor } from '../types';
import {
  assertExtractedMarkdown,
  countWords,
  decodeUtf8,
  filenameToTitle,
  normalizeLineEndings,
} from '../utils';

const MAX_CSV_ROWS = 500;
const MAX_CSV_COLUMNS = 50;

export class CsvExtractor implements FileExtractor {
  readonly name = 'CsvExtractor';
  readonly supportedExtensions = ['csv'] as const;
  readonly supportedMimeTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];

  async extract(input: FileExtractionInput): Promise<FileExtractionResult> {
    const csvContent = normalizeLineEndings(decodeUtf8(input.buffer));
    const parsed = Papa.parse<string[]>(csvContent, {
      skipEmptyLines: 'greedy',
    });

    if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
      throw new FileExtractionError('CSV file is empty.');
    }

    const rows = parsed.data
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim().length > 0))
      .map((row) => row.map((cell) => String(cell ?? '')));

    if (rows.length === 0) {
      throw new FileExtractionError('CSV file is empty.');
    }

    const warnings = parsed.errors.map((error) => `Row ${error.row ?? 'unknown'}: ${error.message}`);
    if (rows.length > MAX_CSV_ROWS + 1) {
      warnings.push(`CSV was truncated to ${MAX_CSV_ROWS} data rows.`);
    }

    const headerRow = rows[0].slice(0, MAX_CSV_COLUMNS);
    if (rows[0].length > MAX_CSV_COLUMNS) {
      warnings.push(`CSV was truncated to ${MAX_CSV_COLUMNS} columns.`);
    }

    const headers = headerRow.map((header, index) => escapeMarkdownTableCell(header.trim() || `Column ${index + 1}`));
    const dataRows = rows.slice(1, MAX_CSV_ROWS + 1).map((row) =>
      headers.map((_, index) => escapeMarkdownTableCell(row[index] ?? ''))
    );

    const title = filenameToTitle(input.filename);
    const table = [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...dataRows.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n');
    const markdownContent = [`# ${title}`, '', table].join('\n');

    assertExtractedMarkdown(markdownContent, input.filename);

    return {
      filename: input.filename,
      originalType: input.mimeType || 'text/csv',
      markdownContent,
      wordCount: countWords(markdownContent),
      title,
      extension: 'csv',
      originalSize: input.buffer.length,
      warnings: warnings.length ? warnings : undefined,
      metadata: {
        sheetCount: 1,
      },
    };
  }
}

function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .trim();
}

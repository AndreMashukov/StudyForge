import { JsonSanitizer } from '../gemini/json-sanitizer';

export interface SlideOutlineItem {
  title: string;
  content: string;
  speakerNotes?: string;
}

export function parseSlideDeckOutlineJson(raw: string): SlideOutlineItem[] {
  let cleanText = raw.trim();
  cleanText = cleanText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  cleanText = JsonSanitizer.sanitizeJsonText(cleanText);

  const parsed = JSON.parse(cleanText) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Invalid slide deck response: expected non-empty array');
  }

  return parsed.map((item, i) => {
    const row = item as Record<string, unknown>;
    if (typeof row.title !== 'string' || !row.title.trim()) {
      throw new Error(`Slide ${i}: missing or empty "title"`);
    }

    let resolvedContent: string | undefined;
    if (typeof row.content === 'string' && row.content.trim()) {
      resolvedContent = row.content;
    } else if (Array.isArray(row.content)) {
      resolvedContent = (row.content as unknown[]).map(String).join('\n');
    } else if (typeof row.bullets === 'string' && row.bullets.trim()) {
      resolvedContent = row.bullets;
    } else if (Array.isArray(row.bullets)) {
      resolvedContent = (row.bullets as unknown[]).map((b) => `• ${b}`).join('\n');
    } else if (typeof row.body === 'string' && row.body.trim()) {
      resolvedContent = row.body;
    } else if (typeof row.points === 'string' && row.points.trim()) {
      resolvedContent = row.points;
    } else if (Array.isArray(row.points)) {
      resolvedContent = (row.points as unknown[]).map((p) => `• ${p}`).join('\n');
    }

    if (!resolvedContent) {
      throw new Error(
        `Slide ${i}: missing or empty content (checked: content, bullets, body, points)`
      );
    }

    return {
      title: row.title.trim(),
      content: resolvedContent.trim(),
      speakerNotes:
        typeof row.speakerNotes === 'string' ? row.speakerNotes : undefined,
    };
  });
}

import { JsonSanitizer } from './json-sanitizer';

export interface RuleGenerationResponse {
  name: string;
  description: string;
  content: string;
}

export function parseRuleResponse(responseText: string): RuleGenerationResponse {
  let cleanText = '';
  try {
    cleanText = JsonSanitizer.initialCleanup(responseText);
    cleanText = JsonSanitizer.sanitizeJsonText(cleanText);
    cleanText = JsonSanitizer.applyComprehensiveCleanup(cleanText);
    cleanText = JsonSanitizer.applyStateBased(cleanText);

    const parsed = JSON.parse(cleanText);

    if (!parsed.name || !parsed.description || !parsed.content) {
      throw new Error('Missing required fields: name, description, or content');
    }

    return {
      name: String(parsed.name),
      description: String(parsed.description),
      content: String(parsed.content),
    };
  } catch (error) {
    JsonSanitizer.logParsingError(error, responseText, cleanText);

    try {
      const fallbackResult = JsonSanitizer.tryFallbackParsing(cleanText) as Record<string, unknown>;
      if (fallbackResult.name && fallbackResult.description && fallbackResult.content) {
        return {
          name: String(fallbackResult.name),
          description: String(fallbackResult.description),
          content: String(fallbackResult.content),
        };
      }
    } catch {
      // fall through
    }

    throw new Error('Failed to parse rule response from LLM');
  }
}

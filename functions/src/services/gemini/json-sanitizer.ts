import * as functions from 'firebase-functions';

/**
 * JSON Sanitization Helper for Gemini AI Responses
 * 
 * This module contains utilities to clean and sanitize JSON responses from Gemini AI
 * to handle common formatting issues that cause JSON parsing errors.
 */

/**
 * Content validation patterns that might cause JSON parsing issues
 */
interface ProblemPattern {
  pattern: RegExp;
  description: string;
}

/**
 * Fallback parsing strategies for different types of JSON issues
 */
interface ParseStrategy {
  name: string;
  transform: (text: string) => string;
  description: string;
}

export class JsonSanitizer {
  
  /**
   * Validate content for patterns that might cause JSON parsing issues
   */
  static validateContentForSafeGeneration(content: string): string {
    const problemPatterns: ProblemPattern[] = [
      { pattern: /"[^"]*"/g, description: 'quoted code/function names' },
      { pattern: /`[^`]*`/g, description: 'backtick code blocks' },
      { pattern: /\\"[^"]*\\"/g, description: 'escaped quotes' }
    ];

    problemPatterns.forEach(({ pattern, description }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 5) {
        functions.logger.warn(`High number of ${description} detected in content (${matches.length} instances). This may cause JSON parsing issues.`);
      }
    });

    return content;
  }

  /**
   * Primary sanitization - handles basic cleanup and common patterns
   */
  static sanitizeJsonText(text: string): string {
    let sanitized = text;
    
    // ONLY remove backticks - they are never valid in JSON
    sanitized = sanitized.replace(/`/g, '');
    
    // Fix unquoted code in arrays - look for patterns like: Send(), GetUser(), etc.
    // Pattern: [\n        FunctionName(), -> [\n        "FunctionName()",
    sanitized = sanitized.replace(/(\[\s*\n\s*)([A-Za-z_][A-Za-z0-9_]*\(\))/g, '$1"$2"');
    
    // Fix unquoted strings in arrays that start with capital letters
    // Pattern: [\n        SomeValue -> [\n        "SomeValue"
    sanitized = sanitized.replace(/(\[\s*\n\s*)([A-Z][A-Za-z0-9_\s]+)(?=\s*[,\]])/g, '$1"$2"');
    
    return sanitized;
  }

  /**
   * Initial cleanup - removes markdown and basic formatting
   */
  static initialCleanup(responseText: string): string {
    let cleanText = responseText.trim();
    
    // Remove markdown code blocks if present
    cleanText = cleanText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    
    // Find JSON content between curly braces
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    return cleanText;
  }

  /**
   * Apply comprehensive cleaning fixes for common Gemini AI JSON issues
   */
  static applyComprehensiveCleanup(text: string): string {
    let cleanText = text;

    // Fix common JSON formatting issues from Gemini AI
    // Remove backticks entirely - they're used for code formatting but break JSON
    cleanText = cleanText.replace(/`([^`]*)`/g, '$1');
    
    // Fix any remaining backticks that might be escaped
    cleanText = cleanText.replace(/\\`/g, '`');
    
    // Fix missing commas between array objects - common Gemini AI issue
    cleanText = cleanText.replace(/}\s*\n\s*{/g, '},\n    {');
    cleanText = cleanText.replace(/}\s*{/g, '}, {');
    
    // Fix missing commas between string array elements
    cleanText = cleanText.replace(/"\s*\n\s*"/g, '",\n    "');
    cleanText = cleanText.replace(/"\s*"/g, '", "');
    
    // Handle escaped quotes in JSON string values
    cleanText = cleanText.replace(/\\"/g, "'");
    cleanText = cleanText.replace(/\\\"/g, "'");
    cleanText = cleanText.replace(/&quot;/g, '"');
    cleanText = cleanText.replace(/\\\\"/g, '\\"');
    cleanText = cleanText.replace(/\s\\"\s/g, " ' ");

    // Fix missing commas after property values
    cleanText = cleanText.replace(/"\s*\n\s*"([a-zA-Z_])/g, '",\n      "$1');
    cleanText = cleanText.replace(/(\d+)\s*\n\s*"([a-zA-Z_])/g, '$1,\n      "$2');
    
    // Fix malformed property separators
    cleanText = cleanText.replace(/"\s*"([a-zA-Z_])/g, '", "$1');

    return cleanText;
  }

  /**
   * State-based character processing for advanced cleanup
   */
  static applyStateBased(text: string): string {
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1] || '';
      
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        result += char;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        result += char;
        continue;
      }
      
      // Inside strings, handle problematic characters
      if (inString) {
        if (char === '`') {
          // Skip backticks inside strings
          continue;
        }
        if (char === '"' && nextChar !== ':' && nextChar !== ',' && nextChar !== '}' && nextChar !== ']') {
          // Replace inner quotes with single quotes
          result += "'";
          continue;
        }
      }
      
      result += char;
    }
    
    return result;
  }

  /**
   * Get all available fallback parsing strategies
   */
  static getFallbackStrategies(): ParseStrategy[] {
    return [
      {
        name: 'unquoted-values',
        description: 'Fix unquoted values in arrays',
        transform: (text: string) => text
          .replace(/(\[\s*\n?\s*)([A-Za-z_][A-Za-z0-9_]*\(\))(\s*[,\]])/g, '$1"$2"$3')
          .replace(/(\[\s*\n?\s*)([A-Z][A-Za-z0-9_\s]+)(\s*[,\]])/g, '$1"$2"$3')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/\\"/g, '"')
      },
      {
        name: 'conservative-cleanup',
        description: 'Conservative approach - only fix obvious issues',
        transform: (text: string) => text
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
      },
      {
        name: 'aggressive-quote-normalization',
        description: 'Aggressive quote pattern fixes',
        transform: (text: string) => text
          .replace(/\\+"/g, '"')
          .replace(/"\s*"\s*:/g, '":')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
      }
    ];
  }

  /**
   * Attempt parsing with multiple fallback strategies
   */
  static tryFallbackParsing(cleanText: string): any {
    const strategies = this.getFallbackStrategies();

    for (const strategy of strategies) {
      try {
        functions.logger.info(`Attempting fallback parsing with strategy: ${strategy.name}`);
        const transformedText = strategy.transform(cleanText);
        const result = JSON.parse(transformedText);
        functions.logger.info(`Fallback parsing successful with strategy: ${strategy.name}`);
        return result;
      } catch (error) {
        functions.logger.warn(`Fallback strategy '${strategy.name}' failed:`, error);
      }
    }

    throw new Error('All fallback parsing strategies failed');
  }

  /**
   * Log detailed error information for debugging
   */
  static logParsingError(error: any, responseText: string, cleanText: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Extract position information if it's a JSON parsing error
    const positionMatch = errorMessage.match(/at position (\d+)/);
    let contextInfo = '';
    
    if (positionMatch && cleanText) {
      const position = parseInt(positionMatch[1]);
      const start = Math.max(0, position - 50);
      const end = Math.min(cleanText.length, position + 50);
      const context = cleanText.substring(start, end);
      const relativePos = position - start;
      
      // Add visual indicator for the exact position
      const contextWithIndicator = context.substring(0, relativePos) + '→[' + (cleanText[position] || 'EOF') + ']←' + context.substring(relativePos + 1);
      
      // Character analysis
      const charAtError = cleanText[position] || 'EOF';
      const charCodeAtError = cleanText.charCodeAt(position) || 'N/A';
      const charBefore = cleanText[position - 1] || 'N/A';
      const charAfter = cleanText[position + 1] || 'N/A';
      
      contextInfo = `Context around position ${position}: "${contextWithIndicator}". Character: "${charAtError}" (code: ${charCodeAtError}). Before: "${charBefore}", After: "${charAfter}"`;
    }
    
    functions.logger.error("Error parsing Gemini AI response:", { 
      error: errorMessage, 
      contextInfo,
      responseText: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      cleanText: cleanText ? cleanText.substring(0, 500) + (cleanText.length > 500 ? '...' : '') : 'undefined'
    });
    
    // Additional detailed logging for position-specific errors
    if (positionMatch && cleanText) {
      const position = parseInt(positionMatch[1]);
      functions.logger.error("Detailed position analysis:", {
        position,
        charAtError: cleanText[position] || 'EOF',
        charCode: cleanText.charCodeAt(position) || 'N/A',
        contextBefore: cleanText.substring(Math.max(0, position - 20), position),
        contextAfter: cleanText.substring(position, Math.min(cleanText.length, position + 20)),
        fullContext: cleanText.substring(Math.max(0, position - 50), Math.min(cleanText.length, position + 50))
      });
    }
    
    // Log common issue patterns
    this.logCommonIssues(responseText, cleanText, errorMessage, positionMatch);
  }

  /**
   * Log information about common JSON issues detected
   */
  private static logCommonIssues(responseText: string, cleanText: string, errorMessage: string, positionMatch: RegExpMatchArray | null): void {
    if (responseText.includes('`')) {
      functions.logger.warn("Backtick characters detected in response - this may cause JSON parsing issues");
    }
    
    if (cleanText.includes('\\"')) {
      functions.logger.warn("Escaped quotes detected in response - this may cause JSON parsing issues");
    }
    
    // Check for missing commas between objects
    if (cleanText.match(/}\s*{/)) {
      functions.logger.warn("Missing comma between objects detected - attempting to fix");
    }
    
    // Check for missing commas in arrays specifically
    if (errorMessage.includes("Expected ',' or ']'") && positionMatch) {
      const position = parseInt(positionMatch[1]);
      const beforeError = cleanText.substring(Math.max(0, position - 10), position);
      const afterError = cleanText.substring(position, Math.min(cleanText.length, position + 10));
      
      if (beforeError.includes('}') && afterError.trim().startsWith('{')) {
        functions.logger.error("Detected missing comma between array objects at position " + position);
      }
    }
  }
}
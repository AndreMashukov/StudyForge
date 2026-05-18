import { logger } from 'firebase-functions/v2';
import {
  DocumentSourceType,
  DocumentStatus,
  GenerateFromScreenshotRequest,
  GenerateFromScreenshotResponse,
  RuleApplicability,
} from '@shared-types';
import { DocumentCrudService } from './document-crud';
import { directoryService } from './directory';
import { GeminiService } from './gemini';
import { isRuleResolutionMode, resolveEffectiveRules } from './rule-resolution';

const MAX_SCREENSHOT_BASE64_LENGTH = 14_000_000;

export interface ScreenshotDocumentGenerationInput
  extends GenerateFromScreenshotRequest {
  userId: string;
}

export class ScreenshotDocumentGenerationService {
  static async generate(
    input: ScreenshotDocumentGenerationInput
  ): Promise<GenerateFromScreenshotResponse> {
    this.validateInput(input);

    const userId = input.userId;
    const directoryId = input.directoryId.trim();

    await directoryService.validateDirectoryId(userId, directoryId);

    const mode = input.ruleIds?.length
      ? isRuleResolutionMode(input.ruleResolutionMode)
        ? input.ruleResolutionMode
        : 'explicit-only'
      : 'inherit';

    const { text: rulesText, ruleIds: effectiveRuleIds } = await resolveEffectiveRules({
      userId,
      directoryId,
      operation: RuleApplicability.PROMPT,
      additionalRuleIds: input.ruleIds || [],
      mode,
    });

    if (rulesText) {
      logger.info('Injecting effective rules into screenshot document generation', {
        ruleCount: effectiveRuleIds.length,
        userId,
        mode,
      });
    }

    const generatedContent = await GeminiService.generateDocumentFromScreenshot(
      input.imageBase64,
      input.prompt,
      rulesText || undefined
    );

    const title = this.resolveTitle({
      generatedContent,
      title: input.title,
      prompt: input.prompt,
    });
    const wordCount = this.countWords(generatedContent);

    const document = await DocumentCrudService.createDocument(userId, {
      title,
      description: `Captured from screenshot${input.prompt ? `: ${input.prompt.substring(0, 100)}` : ''}`,
      content: generatedContent,
      sourceType: DocumentSourceType.GENERATED,
      status: DocumentStatus.ACTIVE,
      tags: ['screenshot', 'captured'],
      directoryId,
    });

    return {
      documentId: document.id,
      title: document.title,
      content: generatedContent,
      wordCount,
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceType: 'screenshot',
        directoryId,
        prompt: input.prompt,
      },
    };
  }

  private static validateInput(input: ScreenshotDocumentGenerationInput): void {
    if (!input.userId || typeof input.userId !== 'string') {
      throw new Error('userId is required');
    }

    if (!input.imageBase64 || typeof input.imageBase64 !== 'string') {
      throw new Error('imageBase64 is required and must be a base64-encoded string');
    }

    if (input.imageBase64.length > MAX_SCREENSHOT_BASE64_LENGTH) {
      throw new Error('Image too large. Maximum 10MB base64-encoded.');
    }

    if (!input.directoryId || typeof input.directoryId !== 'string' || !input.directoryId.trim()) {
      throw new Error('directoryId is required');
    }

    if (input.ruleIds && !Array.isArray(input.ruleIds)) {
      throw new Error('ruleIds must be an array');
    }
  }

  private static resolveTitle({
    generatedContent,
    title,
    prompt,
  }: {
    generatedContent: string;
    title?: string;
    prompt?: string;
  }): string {
    if (title?.trim()) {
      return title.trim();
    }

    const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim();
    }

    if (prompt?.trim()) {
      const trimmedPrompt = prompt.trim();
      return trimmedPrompt.length > 50
        ? `${trimmedPrompt.substring(0, 50)}...`
        : trimmedPrompt;
    }

    return 'Captured Document';
  }

  private static countWords(content: string): number {
    const trimmedContent = content.trim();
    return trimmedContent ? trimmedContent.split(/\s+/).length : 0;
  }
}
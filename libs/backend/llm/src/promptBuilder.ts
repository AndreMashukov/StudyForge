import * as logger from 'firebase-functions/logger';
import { formatRulesForPrompt } from '@study-forge/backend-directories/rule-resolution';

/**
 * PromptBuilder Service
 * 
 * Handles formatting and injection of rules into AI prompts for all operations
 */
export class PromptBuilder {
  /**
   * Inject rules into AI prompt with hierarchical formatting
   * 
   * @param basePrompt - The base prompt without rules
   * @param ruleIds - Array of rule IDs to inject
   * @param userId - User ID for authentication
   * @returns Complete prompt with rules injected
   */
  static async injectRules(
    basePrompt: string,
    ruleIds: string[],
    userId: string
  ): Promise<string> {
    // If no rules provided, return base prompt unchanged
    if (!ruleIds || ruleIds.length === 0) {
      logger.info('No rules to inject, using base prompt');
      return basePrompt;
    }

    logger.info('Injecting rules into prompt', { ruleCount: ruleIds.length, userId });

    try {
      // Format rules with hierarchical numbering using rule-resolution service
      const rulesSection = await formatRulesForPrompt(userId, ruleIds);

      if (!rulesSection) {
        logger.warn('No rules formatted, using base prompt');
        return basePrompt;
      }

      // Inject rules at the beginning of the prompt
      const finalPrompt = `${rulesSection}\n\n${basePrompt}`;

      logger.info('Rules injected successfully', {
        ruleCount: ruleIds.length,
        promptLength: finalPrompt.length,
      });

      return finalPrompt;
    } catch (error) {
      logger.error('Failed to inject rules', { error, userId, ruleIds });
      // On error, return base prompt to avoid breaking the operation
      return basePrompt;
    }
  }

  /**
   * Validate that required rules are present for an operation
   */
  static validateRules(ruleIds: string[], operation: string, minRequired = 1): boolean {
    if (!ruleIds || ruleIds.length < minRequired) {
      logger.warn('Insufficient rules provided', {
        operation,
        provided: ruleIds?.length || 0,
        required: minRequired,
      });
      return false;
    }
    return true;
  }
}

export const promptBuilder = PromptBuilder;

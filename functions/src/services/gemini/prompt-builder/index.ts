/**
 * Prompt Builder Module
 * 
 * This module exports specialized prompt builders for different types of 
 * Gemini AI interactions.
 */

export { QuizPromptBuilder } from './quiz-prompt-builder';
export { FollowupPromptBuilder } from './followup-prompt-builder';

import { QuizPromptBuilder } from './quiz-prompt-builder';
import { FollowupPromptBuilder } from './followup-prompt-builder';

// Re-export for backward compatibility
export class PromptBuilder {
  /**
   * Build the comprehensive prompt for quiz generation
   * @deprecated Use QuizPromptBuilder.buildQuizPrompt instead
   */
  static buildQuizPrompt = QuizPromptBuilder.buildQuizPrompt;

  /**
   * Build a simple prompt for content generation (non-quiz)
   * @deprecated Use QuizPromptBuilder.buildContentPrompt instead
   */
  static buildContentPrompt = QuizPromptBuilder.buildContentPrompt;

  /**
   * Build comprehensive followup explanation prompt
   * @deprecated Use FollowupPromptBuilder.buildFollowupPrompt instead
   */
  static buildFollowupPrompt = FollowupPromptBuilder.buildFollowupPrompt;
}
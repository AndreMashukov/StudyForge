import { DocumentQuestionContext } from '@shared-types';

/**
 * Document Question Prompt Builder for Gemini AI
 * 
 * Builds prompts for answering user questions about a specific document.
 */
export class DocumentQuestionPromptBuilder {

  /**
   * Build prompt for answering a question about a document
   */
  static buildPrompt(context: DocumentQuestionContext): string {
    const basePrompt = `You are an expert educator and analyst. A user is reading a document and has a question about it.

DOCUMENT CONTEXT:
Title: "${context.document.title}"
Content:
${context.document.content}

USER'S QUESTION:
${context.question}

TASK:
Answer the user's question based on the document content. Provide a comprehensive, educational response in markdown format that:

1. **Directly answers the question** using information from the document
2. **Provides relevant context** and explanations from the document content
3. **Includes examples or references** from the document where applicable
4. **Offers additional insights** that help deepen understanding of the topic

FORMATTING REQUIREMENTS:
- Use proper markdown structure with clear headings
- Keep the response focused and relevant to the question
- If the question cannot be answered from the document content alone, acknowledge this and provide the best possible answer based on available information
- If ASCII diagrams would help explain the concept, wrap them in triple backticks

Generate a helpful, accurate markdown response.`;

    if (context.customInstructions) {
      return `${context.customInstructions}\n\n${basePrompt}`;
    }
    return basePrompt;
  }
}

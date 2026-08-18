import {
  BaseLlm,
  type BaseLlmConnection,
  type LlmRequest,
  type LlmResponse,
} from '@google/adk';
import type { GenerationKind } from '@shared-types';
import {
  callToolChatCompletions,
  LlmGenerationRouteResolver,
} from '@study-forge/backend-llm/llm';
import { patchProviderCostContext } from '@study-forge/backend-core/services/provider-cost';
import {
  geminiContentsToToolChatMessages,
  llmRequestToOpenAiTools,
  readSystemInstruction,
  toolChatAssistantToContent,
} from './adk-content-converter';

export type StudyForgeAdkGenerationKind = Extract<
  GenerationKind,
  'directoryAgent' | 'directoryChat' | 'agentExecutor'
>;

export interface StudyForgeAdkLlmInput {
  userId: string;
  generationKind: StudyForgeAdkGenerationKind;
}

export class StudyForgeAdkLlm extends BaseLlm {
  private readonly userId: string;
  private readonly generationKind: StudyForgeAdkGenerationKind;

  constructor(input: StudyForgeAdkLlmInput) {
    super({ model: `studyforge-${input.generationKind}` });
    this.userId = input.userId;
    this.generationKind = input.generationKind;
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream = false,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    if (abortSignal?.aborted) {
      yield { errorMessage: 'Aborted', turnComplete: true };
      return;
    }

    this.maybeAppendUserContent(llmRequest);

    patchProviderCostContext({ generationKind: this.generationKind });

    const resolution = await LlmGenerationRouteResolver.resolve(
      this.generationKind,
      { userId: this.userId },
    );
    if (!resolution.providerApiKey) {
      throw new Error('Workspace agent credentials are missing');
    }

    const systemInstruction = readSystemInstruction(
      llmRequest.config?.systemInstruction,
    );
    const historyMessages = geminiContentsToToolChatMessages(
      llmRequest.contents,
    );
    const messages = systemInstruction
      ? [
          { role: 'system' as const, content: systemInstruction },
          ...historyMessages,
        ]
      : historyMessages;

    const assistant = await callToolChatCompletions({
      route: resolution.route,
      apiKey: resolution.providerApiKey,
      messages,
      tools: llmRequestToOpenAiTools(llmRequest),
      stream,
    });

    yield {
      content: toolChatAssistantToContent(assistant),
      turnComplete: true,
    };
  }

  connect(llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    void llmRequest;
    return Promise.reject(
      new Error(
        'Live mode is not supported for the StudyForge workspace agent',
      ),
    );
  }
}

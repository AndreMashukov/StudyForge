import {
  Directory,
  DirectoryChatArtifactContext,
  DirectoryChatMessage,
  DirectoryChatPromptContext,
  RuleApplicability,
} from '@shared-types';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { resolveEffectiveRules } from './rule-resolution';
import {
  ChatRetrievalStrategy,
  DirectoryChatSourceDocument,
  SimpleDirectoryChatRetrievalStrategy,
} from './directory-chat-retrieval';

const RECENT_MESSAGE_LIMIT = 8;

export interface DirectoryChatContextAssemblerParams {
  userId: string;
  directory: Directory;
  message: string;
  previousMessages: DirectoryChatMessage[];
  conversationSummary?: string;
  artifactContext?: DirectoryChatArtifactContext;
  selectedDocumentIds: string[];
}

export interface DirectoryChatContextAssemblerResult {
  promptContext: DirectoryChatPromptContext;
}

export class DirectoryChatContextAssembler {
  constructor(
    private readonly retrievalStrategy: ChatRetrievalStrategy = new SimpleDirectoryChatRetrievalStrategy()
  ) {}

  async assemble(params: DirectoryChatContextAssemblerParams): Promise<DirectoryChatContextAssemblerResult> {
    const documents = await this.loadSelectedDocuments(
      params.userId,
      params.selectedDocumentIds
    );

    if (documents.length === 0) {
      throw new Error('Select at least one source for chat.');
    }

    const followupRuleIds = this.getFollowupRuleIds(params.artifactContext);

    const [{ text: chatRules }, { text: followupRules }, retrievedChunks] = await Promise.all([
      resolveEffectiveRules({
        userId: params.userId,
        directoryId: params.directory.id,
        operation: RuleApplicability.CHAT,
        mode: 'inherit',
      }),
      followupRuleIds.length > 0
        ? resolveEffectiveRules({
          userId: params.userId,
          operation: RuleApplicability.FOLLOWUP,
          additionalRuleIds: followupRuleIds,
          mode: 'explicit-only',
        })
        : Promise.resolve({ text: '' }),
      this.retrievalStrategy.selectContext({
        message: params.message,
        documents,
        artifactContext: params.artifactContext,
      }),
    ]);

    return {
      promptContext: {
        directoryName: params.directory.name,
        userMessage: params.message,
        chatRules: [chatRules, followupRules].filter((rules) => rules.trim()).join('\n\n'),
        conversationSummary: params.conversationSummary,
        recentMessages: params.previousMessages.slice(-RECENT_MESSAGE_LIMIT),
        retrievedChunks,
        artifactContext: params.artifactContext,
      },
    };
  }

  private getFollowupRuleIds(artifactContext?: DirectoryChatArtifactContext): string[] {
    if (!artifactContext?.followupRuleIds?.length) {
      return [];
    }

    if (!['quiz', 'diagramQuiz', 'sequenceQuiz'].includes(artifactContext.type)) {
      return [];
    }

    return artifactContext.followupRuleIds;
  }

  private async loadSelectedDocuments(
    userId: string,
    selectedDocumentIds: string[]
  ): Promise<DirectoryChatSourceDocument[]> {
    return Promise.all(
      selectedDocumentIds.map(async (documentId) => {
        const document = await DocumentCrudService.getDocumentWithContent(userId, documentId);
        return {
          id: document.id,
          title: document.title,
          content: document.content || '',
        };
      })
    );
  }
}

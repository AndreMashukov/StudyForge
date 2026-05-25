import {
  Directory,
  DirectoryChatArtifactContext,
  DirectoryChatMessage,
  DirectoryChatPromptContext,
  RuleApplicability,
} from '@shared-types';
import { FirestorePaths } from '../lib/firestore-paths';
import { DocumentCrudService } from './document-crud';
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
}

export interface DirectoryChatContextAssemblerResult {
  promptContext: DirectoryChatPromptContext;
  documentCount: number;
}

export class DirectoryChatContextAssembler {
  constructor(
    private readonly retrievalStrategy: ChatRetrievalStrategy = new SimpleDirectoryChatRetrievalStrategy()
  ) {}

  async assemble(params: DirectoryChatContextAssemblerParams): Promise<DirectoryChatContextAssemblerResult> {
    const documents = await this.loadDirectDirectoryDocuments(params.userId, params.directory.id);

    if (documents.length === 0) {
      throw new Error('Add a source to this directory before starting chat.');
    }

    const [{ text: chatRules }, retrievedChunks] = await Promise.all([
      resolveEffectiveRules({
        userId: params.userId,
        directoryId: params.directory.id,
        operation: RuleApplicability.CHAT,
        mode: 'inherit',
      }),
      this.retrievalStrategy.selectContext({
        message: params.message,
        documents,
        artifactContext: params.artifactContext,
      }),
    ]);

    return {
      documentCount: documents.length,
      promptContext: {
        directoryName: params.directory.name,
        userMessage: params.message,
        chatRules,
        conversationSummary: params.conversationSummary,
        recentMessages: params.previousMessages.slice(-RECENT_MESSAGE_LIMIT),
        retrievedChunks,
        artifactContext: params.artifactContext,
      },
    };
  }

  private async loadDirectDirectoryDocuments(userId: string, directoryId: string): Promise<DirectoryChatSourceDocument[]> {
    const docsSnapshot = await FirestorePaths.documents(userId)
      .where('directoryId', '==', directoryId)
      .get();

    return Promise.all(
      docsSnapshot.docs.map(async (docSnapshot) => {
        const document = await DocumentCrudService.getDocumentWithContent(userId, docSnapshot.id);
        return {
          id: document.id,
          title: document.title,
          content: document.content || '',
        };
      })
    );
  }
}

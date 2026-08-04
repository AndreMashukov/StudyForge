import { directoryService } from '@study-forge/backend-directories/directory';
import { getRule } from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentKnowledgeIndexService } from './agent-knowledge-index-service';

export class AgentKnowledgeLifecycle {
  static async indexDirectory(userId: string, directoryId: string): Promise<void> {
    const directory = await directoryService.getDirectory(userId, directoryId);
    if (!directory) {
      return;
    }

    const text = `Directory: ${directory.name}\nPath: ${directory.path}\nDescription: ${directory.description || 'No description'}`;
    await AgentKnowledgeIndexService.replaceSourceChunks({
      userId,
      sourceType: 'directory',
      sourceId: directory.id,
      sourceTitle: directory.name,
      text,
      directoryId: directory.id,
    });
  }

  static async indexDocument(userId: string, documentId: string): Promise<void> {
    const loaded = await DocumentCrudService.getDocumentWithContent(userId, documentId);
    if (!loaded) {
      return;
    }

    await AgentKnowledgeIndexService.replaceSourceChunks({
      userId,
      sourceType: 'document',
      sourceId: loaded.document.id,
      sourceTitle: loaded.document.title,
      text: AgentKnowledgeIndexService.formatDocumentText(
        loaded.document.title,
        loaded.document.description,
        loaded.content
      ),
      directoryId: loaded.document.directoryId,
      documentId: loaded.document.id,
    });
  }

  static async indexRule(userId: string, ruleId: string): Promise<void> {
    const rule = await getRule(userId, ruleId);
    if (!rule) {
      return;
    }

    const text = `Rule: ${rule.name}\nDescription: ${rule.description || 'No description'}\n\n${rule.content}`;
    await AgentKnowledgeIndexService.replaceSourceChunks({
      userId,
      sourceType: 'rule',
      sourceId: rule.id,
      sourceTitle: rule.name,
      text,
    });
  }

  static async indexQuiz(userId: string, quizId: string): Promise<void> {
    const snapshot = await FirestorePaths.quiz(userId, quizId).get();
    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data();
    const title = typeof data?.title === 'string' ? data.title : 'Quiz';
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    const questionBlocks = questions
      .map((question, index) => {
        if (typeof question !== 'object' || question === null) {
          return '';
        }
        const record = question as Record<string, unknown>;
        const prompt = typeof record.question === 'string' ? record.question : '';
        const explanation = typeof record.explanation === 'string' ? record.explanation : '';
        return `Question ${index + 1}: ${prompt}\nExplanation: ${explanation}`;
      })
      .filter(Boolean);

    await AgentKnowledgeIndexService.replaceSourceChunks({
      userId,
      sourceType: 'quiz',
      sourceId: quizId,
      sourceTitle: title,
      text: `Quiz: ${title}\n${questionBlocks.join('\n\n')}`,
      directoryId: typeof data?.directoryId === 'string' ? data.directoryId : undefined,
    });
  }

  static async deleteDirectoryIndex(userId: string, directoryId: string): Promise<void> {
    await AgentKnowledgeIndexService.deleteSourceIndex(userId, 'directory', directoryId);
  }

  static async deleteDocumentIndex(userId: string, documentId: string): Promise<void> {
    await AgentKnowledgeIndexService.deleteSourceIndex(userId, 'document', documentId);
  }

  static async deleteRuleIndex(userId: string, ruleId: string): Promise<void> {
    await AgentKnowledgeIndexService.deleteSourceIndex(userId, 'rule', ruleId);
  }

  static async deleteQuizIndex(userId: string, quizId: string): Promise<void> {
    await AgentKnowledgeIndexService.deleteSourceIndex(userId, 'quiz', quizId);
  }
}

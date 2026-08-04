import type {
  AgentActionKind,
  AgentActionResult,
  AgentProposedDelete,
  AgentScope,
} from '@shared-types';
import { DocumentSourceType, RuleApplicability, RuleColor } from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import { createRule, getRules, attachRuleToDirectory } from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import { createPendingQuiz } from '@study-forge/backend-artifacts/artifact-generation-records';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentKnowledgeIndexService } from '../knowledge/agent-knowledge-index-service';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';

export interface AgentToolRuntimeContext {
  userId: string;
  scope: AgentScope;
  directoryId?: string;
  directoryIds: string[];
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

function pushAction(context: AgentToolRuntimeContext, action: AgentActionResult): void {
  context.executedActions.push(action);
}

function assertDirectoryInScope(context: AgentToolRuntimeContext, directoryId: string): void {
  if (context.scope === 'workspace') {
    return;
  }
  if (!context.directoryIds.includes(directoryId)) {
    throw new Error('Directory is outside the active agent scope');
  }
}

async function resolveDefaultDirectoryId(context: AgentToolRuntimeContext): Promise<string | undefined> {
  if (context.directoryId && context.directoryIds.includes(context.directoryId)) {
    return context.directoryId;
  }
  return context.directoryIds[0];
}

export function createAgentToolDefinitions(
  context: AgentToolRuntimeContext
): AgentToolDefinition[] {
  return [
    {
      name: 'search_knowledge',
      description: 'Search indexed StudyForge knowledge using semantic retrieval.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) {
          throw new Error('query is required');
        }
        const results = await AgentKnowledgeIndexService.searchKnowledge({
          userId: context.userId,
          query,
          directoryIds: context.directoryIds,
        });
        pushAction(context, {
          kind: 'search_knowledge',
          summary: `Retrieved ${results.length} knowledge chunks`,
        });
        return results;
      },
    },
    {
      name: 'list_directories',
      description: 'List directories available in the current scope.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const directories = await Promise.all(
          context.directoryIds.map((directoryId) =>
            directoryService.getDirectory(context.userId, directoryId)
          )
        );
        return directories.filter(Boolean);
      },
    },
    {
      name: 'list_documents',
      description: 'List documents in scope.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const snapshots = await Promise.all(
          context.directoryIds.map((directoryId) =>
            FirestorePaths.documents(context.userId)
              .where('directoryId', '==', directoryId)
              .get()
          )
        );
        return snapshots.flatMap((snapshot) =>
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      },
    },
    {
      name: 'list_quizzes',
      description: 'List quizzes in scope.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const snapshot = await FirestorePaths.quizzes(context.userId).get();
        return snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              directoryId:
                typeof data.directoryId === 'string' ? data.directoryId : undefined,
            };
          })
          .filter((quiz) =>
            quiz.directoryId ? context.directoryIds.includes(quiz.directoryId) : true
          );
      },
    },
    {
      name: 'list_rules',
      description: 'List user rules.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getRules(context.userId),
    },
    {
      name: 'create_directory',
      description: 'Create a directory in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
      execute: async (args) => {
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        if (!name) {
          throw new Error('name is required');
        }
        const parentId =
          typeof args.parentId === 'string'
            ? args.parentId
            : await resolveDefaultDirectoryId(context);
        const directory = await directoryService.createDirectory(context.userId, {
          name,
          parentId: parentId ?? undefined,
          description: typeof args.description === 'string' ? args.description : undefined,
        });
        await AgentKnowledgeLifecycle.indexDirectory(context.userId, directory.id);
        pushAction(context, {
          kind: 'create_directory',
          summary: `Created directory "${directory.name}"`,
          entityType: 'directory',
          entityId: directory.id,
        });
        return directory;
      },
    },
    {
      name: 'create_document',
      description: 'Create a document from provided text content.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          text: { type: 'string' },
          directoryId: { type: 'string' },
        },
        required: ['title', 'text'],
      },
      execute: async (args) => {
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        const text = typeof args.text === 'string' ? args.text.trim() : '';
        const directoryId =
          typeof args.directoryId === 'string'
            ? args.directoryId
            : await resolveDefaultDirectoryId(context);
        if (!title || !text || !directoryId) {
          throw new Error('title, text, and directoryId are required');
        }
        assertDirectoryInScope(context, directoryId);
        const document = await DocumentCrudService.createDocument(context.userId, {
          title,
          content: text,
          directoryId,
          sourceType: DocumentSourceType.GENERATED,
        });
        await AgentKnowledgeLifecycle.indexDocument(context.userId, document.id);
        pushAction(context, {
          kind: 'create_document',
          summary: `Created document "${document.title}"`,
          entityType: 'document',
          entityId: document.id,
        });
        return document;
      },
    },
    {
      name: 'generate_quiz',
      description: 'Generate a quiz from a document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
          title: { type: 'string' },
          questionCount: { type: 'number' },
        },
        required: ['documentId'],
      },
      execute: async (args) => {
        const documentId = typeof args.documentId === 'string' ? args.documentId : '';
        if (!documentId) {
          throw new Error('documentId is required');
        }
        const document = await DocumentCrudService.getDocument(context.userId, documentId);
        if (!document?.directoryId) {
          throw new Error('Document not found');
        }
        assertDirectoryInScope(context, document.directoryId);
        const quizId = await createPendingQuiz({
          userId: context.userId,
          directoryId: document.directoryId,
          documentId,
          documentIds: [documentId],
          documentTitle: document.title,
          title: typeof args.title === 'string' ? args.title : `${document.title} Quiz`,
        });
        const jobId = await enqueueGenerationJob({
          userId: context.userId,
          directoryId: document.directoryId,
          recordId: quizId,
          kind: 'quiz',
          payload: {
            documentIds: [documentId],
            title: typeof args.title === 'string' ? args.title : `${document.title} Quiz`,
            questionCount:
              typeof args.questionCount === 'number' ? Math.min(args.questionCount, 20) : 10,
          },
        });
        pushAction(context, {
          kind: 'generate_quiz',
          summary: `Started quiz generation for "${document.title}"`,
          entityType: 'quiz',
          entityId: quizId,
          jobId,
        });
        return { quizId, jobId };
      },
    },
    {
      name: 'create_rule',
      description: 'Create a reusable rule.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name', 'content'],
      },
      execute: async (args) => {
        const rule = await createRule(context.userId, {
          name: typeof args.name === 'string' ? args.name : '',
          content: typeof args.content === 'string' ? args.content : '',
          description: typeof args.description === 'string' ? args.description : '',
          color: RuleColor.PURPLE,
          tags: [],
          applicableTo: [RuleApplicability.CHAT],
        });
        await AgentKnowledgeLifecycle.indexRule(context.userId, rule.id);
        pushAction(context, {
          kind: 'create_rule',
          summary: `Created rule "${rule.name}"`,
          entityType: 'rule',
          entityId: rule.id,
        });
        return rule;
      },
    },
    {
      name: 'attach_rule_to_directory',
      description: 'Attach a rule to a directory.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
          ruleId: { type: 'string' },
        },
        required: ['directoryId', 'ruleId'],
      },
      execute: async (args) => {
        const directoryId = typeof args.directoryId === 'string' ? args.directoryId : '';
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId : '';
        assertDirectoryInScope(context, directoryId);
        await attachRuleToDirectory(context.userId, directoryId, ruleId);
        pushAction(context, {
          kind: 'attach_rule',
          summary: 'Attached rule to directory',
          entityType: 'rule',
          entityId: ruleId,
        });
        return { directoryId, ruleId };
      },
    },
    {
      name: 'propose_delete_directory',
      description: 'Propose deleting a directory for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['directoryId'],
      },
      execute: async (args) => {
        const directoryId = typeof args.directoryId === 'string' ? args.directoryId : '';
        const directory = await directoryService.getDirectory(context.userId, directoryId);
        if (!directory) {
          throw new Error('Directory not found');
        }
        context.proposedDeletes.push({
          targetType: 'directory',
          targetId: directoryId,
          label: directory.name,
          reason: typeof args.reason === 'string' ? args.reason : undefined,
        });
        return { proposed: true };
      },
    },
    {
      name: 'propose_delete_documents',
      description: 'Propose deleting one or more documents for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          documentIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
        required: ['documentIds'],
      },
      execute: async (args) => {
        const documentIds = Array.isArray(args.documentIds)
          ? args.documentIds.filter((value): value is string => typeof value === 'string')
          : [];
        for (const documentId of documentIds) {
          const document = await DocumentCrudService.getDocument(context.userId, documentId);
          if (!document) {
            continue;
          }
          context.proposedDeletes.push({
            targetType: 'document',
            targetId: documentId,
            label: document.title,
            reason: typeof args.reason === 'string' ? args.reason : undefined,
          });
        }
        return { proposed: true, count: documentIds.length };
      },
    },
  ];
}

export function toolDefinitionsToOpenAiTools(
  tools: AgentToolDefinition[]
): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function executeAgentTool(
  tools: AgentToolDefinition[],
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = tools.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return tool.execute(args);
}

export function actionKindFromToolName(toolName: string): AgentActionKind | undefined {
  const mapping: Record<string, AgentActionKind> = {
    search_knowledge: 'search_knowledge',
    create_directory: 'create_directory',
    create_document: 'create_document',
    generate_quiz: 'generate_quiz',
    create_rule: 'create_rule',
    attach_rule_to_directory: 'attach_rule',
  };
  return mapping[toolName];
}

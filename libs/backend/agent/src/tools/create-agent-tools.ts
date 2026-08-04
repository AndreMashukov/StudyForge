import type {
  AgentActionKind,
  AgentActionResult,
  AgentProposedDelete,
  AgentScope,
  UpdateRuleRequest,
} from '@shared-types';
import { DocumentSourceType, RuleApplicability, RuleColor } from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  attachRuleToDirectory,
  createRule,
  detachRuleFromDirectory,
  getRule,
  getRules,
  updateRule,
} from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import {
  normalizeGeneratedHtml,
  wrapHtmlDocument,
} from '@study-forge/backend-documents/document-html/html-utils';
import { prepareHtmlDocumentForStorage } from '@study-forge/backend-documents/document-html';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import { createPendingQuiz } from '@study-forge/backend-artifacts/artifact-generation-records';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentKnowledgeIndexService } from '../knowledge/agent-knowledge-index-service';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';
import {
  parseOptionalBoolean,
  parseOptionalRuleApplicabilityArray,
  parseOptionalRuleColor,
  parseRuleApplicabilityArray,
  parseStringArray,
  RULE_APPLICABILITY_ENUM,
  RULE_COLOR_ENUM,
} from './rule-tool-args';

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

function sanitizeDirectoryName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function prepareAgentDocumentContent(
  title: string,
  text: string
): Promise<{ content: string; contentFormat: 'html' }> {
  try {
    const prepared = await prepareHtmlDocumentForStorage(text, title);
    return { content: prepared.fullHtml, contentFormat: 'html' };
  } catch {
    const bodyHtml = normalizeGeneratedHtml(text);
    const fullHtml = wrapHtmlDocument(bodyHtml, title);
    return { content: fullHtml, contentFormat: 'html' };
  }
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
      description:
        'Create a directory in the workspace. Directory names cannot contain / \\ : * ? " < > |; slashes in topics like AI/ML are converted to hyphens automatically.',
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
        const rawName = typeof args.name === 'string' ? args.name.trim() : '';
        const name = sanitizeDirectoryName(rawName);
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
      description:
        'Create an HTML document from provided content. Use HTML body tags (h1, h2, p, ul, li, etc.), not markdown.',
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
        const { content, contentFormat } = await prepareAgentDocumentContent(title, text);
        const document = await DocumentCrudService.createDocument(context.userId, {
          title,
          content,
          contentFormat,
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
      description:
        'Create a reusable rule. Set applicableTo to control which generation kinds use the rule (for example slide_deck, quiz, chat).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string', enum: RULE_COLOR_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          applicableTo: {
            type: 'array',
            items: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          },
          isDefault: { type: 'boolean' },
        },
        required: ['name', 'content'],
      },
      execute: async (args) => {
        const name = typeof args.name === 'string' ? args.name.trim() : '';
        const content = typeof args.content === 'string' ? args.content.trim() : '';
        if (!name || !content) {
          throw new Error('name and content are required');
        }

        const applicableTo =
          args.applicableTo === undefined
            ? [RuleApplicability.CHAT]
            : parseRuleApplicabilityArray(args.applicableTo);

        const rule = await createRule(context.userId, {
          name,
          content,
          description: typeof args.description === 'string' ? args.description : '',
          color:
            args.color === undefined ? RuleColor.PURPLE : parseOptionalRuleColor(args.color) ?? RuleColor.PURPLE,
          tags: args.tags === undefined ? [] : parseStringArray(args.tags),
          applicableTo,
          isDefault: parseOptionalBoolean(args.isDefault) ?? false,
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
      name: 'update_rule',
      description:
        'Update an existing rule. Provide ruleId and any fields to change (name, description, content, color, tags, applicableTo, isDefault).',
      parameters: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' },
          color: { type: 'string', enum: RULE_COLOR_ENUM },
          tags: { type: 'array', items: { type: 'string' } },
          applicableTo: {
            type: 'array',
            items: { type: 'string', enum: RULE_APPLICABILITY_ENUM },
          },
          isDefault: { type: 'boolean' },
        },
        required: ['ruleId'],
      },
      execute: async (args) => {
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
        if (!ruleId) {
          throw new Error('ruleId is required');
        }

        const updateRequest: UpdateRuleRequest = { ruleId };

        if (args.name !== undefined) {
          if (typeof args.name !== 'string' || args.name.trim().length === 0) {
            throw new Error('name must be a non-empty string');
          }
          updateRequest.name = args.name.trim();
        }
        if (args.description !== undefined) {
          if (typeof args.description !== 'string') {
            throw new Error('description must be a string');
          }
          updateRequest.description = args.description;
        }
        if (args.content !== undefined) {
          if (typeof args.content !== 'string' || args.content.trim().length === 0) {
            throw new Error('content must be a non-empty string');
          }
          updateRequest.content = args.content;
        }
        if (args.color !== undefined) {
          updateRequest.color = parseOptionalRuleColor(args.color);
        }
        if (args.tags !== undefined) {
          updateRequest.tags = parseStringArray(args.tags);
        }
        if (args.applicableTo !== undefined) {
          updateRequest.applicableTo = parseOptionalRuleApplicabilityArray(args.applicableTo);
        }
        if (args.isDefault !== undefined) {
          updateRequest.isDefault = parseOptionalBoolean(args.isDefault);
        }

        const hasUpdates =
          updateRequest.name !== undefined ||
          updateRequest.description !== undefined ||
          updateRequest.content !== undefined ||
          updateRequest.color !== undefined ||
          updateRequest.tags !== undefined ||
          updateRequest.applicableTo !== undefined ||
          updateRequest.isDefault !== undefined;

        if (!hasUpdates) {
          throw new Error('Provide at least one field to update');
        }

        const rule = await updateRule(context.userId, updateRequest);
        await AgentKnowledgeLifecycle.indexRule(context.userId, rule.id);
        pushAction(context, {
          kind: 'update_rule',
          summary: `Updated rule "${rule.name}"`,
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
        if (!directoryId || !ruleId) {
          throw new Error('directoryId and ruleId are required');
        }
        assertDirectoryInScope(context, directoryId);
        await attachRuleToDirectory(context.userId, ruleId, directoryId);
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
      name: 'detach_rule_from_directory',
      description: 'Detach a rule from a directory.',
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
        if (!directoryId || !ruleId) {
          throw new Error('directoryId and ruleId are required');
        }
        assertDirectoryInScope(context, directoryId);
        await detachRuleFromDirectory(context.userId, ruleId, directoryId);
        pushAction(context, {
          kind: 'detach_rule',
          summary: 'Detached rule from directory',
          entityType: 'rule',
          entityId: ruleId,
        });
        return { directoryId, ruleId };
      },
    },
    {
      name: 'propose_delete_rule',
      description: 'Propose deleting a rule for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          ruleId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['ruleId'],
      },
      execute: async (args) => {
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
        if (!ruleId) {
          throw new Error('ruleId is required');
        }

        const rule = await getRule(context.userId, ruleId);
        if (!rule) {
          throw new Error('Rule not found');
        }

        context.proposedDeletes.push({
          targetType: 'rule',
          targetId: ruleId,
          label: rule.name,
          reason: typeof args.reason === 'string' ? args.reason : undefined,
        });
        return { proposed: true };
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
    update_rule: 'update_rule',
    attach_rule_to_directory: 'attach_rule',
    detach_rule_from_directory: 'detach_rule',
  };
  return mapping[toolName];
}

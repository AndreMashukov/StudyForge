import type {
  AgentActionKind,
  AgentActionResult,
  AgentPromptContext,
  AgentProposedDelete,
  AgentScope,
  UpdateRuleRequest,
} from '@shared-types';
import {
  DocumentSourceType,
  RuleApplicability,
  RuleColor,
} from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  attachRuleToDirectory,
  createRule,
  detachRuleFromDirectory,
  getRule,
  getRules,
  updateRule,
} from '@study-forge/backend-directories/rule-crud';
import { getApplicableRules } from '@study-forge/backend-directories/rule-resolution';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import { createPendingQuiz } from '@study-forge/backend-artifacts/artifact-generation-records';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { AgentKnowledgeIndexService } from '../knowledge/agent-knowledge-index-service';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';
import { stripHtmlToText } from '../knowledge/knowledge-chunk-utils';
import {
  parseOptionalBoolean,
  parseOptionalRuleApplicabilityArray,
  parseOptionalRuleColor,
  parseRuleApplicabilityArray,
  parseStringArray,
  RULE_APPLICABILITY_ENUM,
  RULE_COLOR_ENUM,
} from './rule-tool-args';
import { createQuizStatisticsToolDefinitions } from './quiz-statistics-tools';

/** Soft cap so tool results stay within model context. */
export const AGENT_DOCUMENT_CONTENT_MAX_CHARS = 60_000;

export interface AgentToolRuntimeContext {
  userId: string;
  scope: AgentScope;
  directoryId?: string;
  directoryIds: string[];
  promptContext?: AgentPromptContext;
  clientLocalDate?: string;
  executedActions: AgentActionResult[];
  proposedDeletes: AgentProposedDelete[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

function pushAction(
  context: AgentToolRuntimeContext,
  action: AgentActionResult,
): void {
  context.executedActions.push(action);
}

function assertDirectoryInScope(
  context: AgentToolRuntimeContext,
  directoryId: string,
): void {
  if (context.scope === 'workspace') {
    return;
  }
  if (!context.directoryIds.includes(directoryId)) {
    throw new Error('Directory is outside the active agent scope');
  }
}

async function resolveDefaultDirectoryId(
  context: AgentToolRuntimeContext,
): Promise<string | undefined> {
  if (
    context.directoryId &&
    context.directoryIds.includes(context.directoryId)
  ) {
    return context.directoryId;
  }
  if (context.promptContext?.type === 'directory') {
    return context.promptContext.directoryId;
  }
  if (
    context.promptContext?.type === 'document' &&
    context.promptContext.directoryId
  ) {
    return context.promptContext.directoryId;
  }
  return context.directoryIds[0];
}

function resolveDefaultDocumentId(
  context: AgentToolRuntimeContext,
): string | undefined {
  if (context.promptContext?.type === 'document') {
    return context.promptContext.documentId;
  }
  return undefined;
}

function truncateAgentText(
  text: string,
  maxChars = AGENT_DOCUMENT_CONTENT_MAX_CHARS,
): {
  text: string;
  truncated: boolean;
  contentLength: number;
} {
  if (text.length <= maxChars) {
    return { text, truncated: false, contentLength: text.length };
  }
  return {
    text: `${text.slice(0, maxChars)}\n\n[truncated: showing first ${maxChars} of ${text.length} characters]`,
    truncated: true,
    contentLength: text.length,
  };
}

export function toAgentReadableDocumentContent(
  content: string,
  contentFormat: string,
): string {
  if (contentFormat === 'html' || content.includes('<')) {
    return stripHtmlToText(content);
  }
  return content.trim();
}

/**
 * Workspace creates default to root. Directory-scoped chats nest under the
 * active directory. Never silently pick the first alphabetized root folder.
 */
function resolveCreateDirectoryParentId(
  context: AgentToolRuntimeContext,
  args: Record<string, unknown>,
): string | undefined {
  if (typeof args.parentId === 'string' && args.parentId.trim().length > 0) {
    const parentId = args.parentId.trim();
    assertDirectoryInScope(context, parentId);
    return parentId;
  }

  if (context.scope === 'directory') {
    if (
      context.directoryId &&
      context.directoryIds.includes(context.directoryId)
    ) {
      return context.directoryId;
    }
    return context.directoryIds[0];
  }

  return undefined;
}

function sanitizeDirectoryName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MIN_CREATE_DOCUMENT_PROMPT_CHARS = 10;

function resolveCreateDocumentPrompt(args: Record<string, unknown>): string {
  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (prompt) {
    return prompt;
  }
  return typeof args.text === 'string' ? args.text.trim() : '';
}

function pendingTitleFromPrompt(prompt: string, title?: string): string {
  if (title) {
    return title;
  }
  return prompt.length > 50 ? `${prompt.substring(0, 50)}…` : prompt;
}

export function createAgentToolDefinitions(
  context: AgentToolRuntimeContext,
): AgentToolDefinition[] {
  return [
    {
      name: 'search_knowledge',
      description:
        'Search indexed StudyForge knowledge using semantic retrieval.',
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
            directoryService.getDirectory(context.userId, directoryId),
          ),
        );
        return directories.filter(Boolean);
      },
    },
    {
      name: 'list_documents',
      description:
        'List document metadata in scope. Pass directoryId to focus on one folder (recommended when UI context is a directory). Does not include document body content; use get_document_content next.',
      parameters: {
        type: 'object',
        properties: {
          directoryId: { type: 'string' },
        },
      },
      execute: async (args) => {
        const requestedDirectoryId =
          typeof args.directoryId === 'string' &&
          args.directoryId.trim().length > 0
            ? args.directoryId.trim()
            : undefined;
        const targetDirectoryIds = requestedDirectoryId
          ? [requestedDirectoryId]
          : context.directoryIds;

        if (requestedDirectoryId) {
          assertDirectoryInScope(context, requestedDirectoryId);
        }

        const snapshots = await Promise.all(
          targetDirectoryIds.map((directoryId) =>
            FirestorePaths.documents(context.userId)
              .where('directoryId', '==', directoryId)
              .get(),
          ),
        );
        return snapshots.flatMap((snapshot) =>
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: typeof data.title === 'string' ? data.title : '',
              directoryId:
                typeof data.directoryId === 'string'
                  ? data.directoryId
                  : undefined,
              description:
                typeof data.description === 'string'
                  ? data.description
                  : undefined,
              sourceType:
                typeof data.sourceType === 'string'
                  ? data.sourceType
                  : undefined,
              updatedAt: data.updatedAt ?? undefined,
            };
          }),
        );
      },
    },
    {
      name: 'get_document_content',
      description:
        'Read the full body of a document. Required before explaining, summarizing, extracting, or rewriting material from an existing document. If documentId is omitted and UI context is a document, uses that document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: { type: 'string' },
        },
      },
      execute: async (args) => {
        const documentId =
          typeof args.documentId === 'string' &&
          args.documentId.trim().length > 0
            ? args.documentId.trim()
            : resolveDefaultDocumentId(context);
        if (!documentId) {
          throw new Error(
            'documentId is required when no document UI context is active',
          );
        }

        const document = await DocumentCrudService.getDocumentWithContent(
          context.userId,
          documentId,
        );
        if (!document.directoryId) {
          throw new Error('Document is missing a directoryId');
        }
        assertDirectoryInScope(context, document.directoryId);

        const readable = toAgentReadableDocumentContent(
          document.content,
          document.contentFormat,
        );
        const truncated = truncateAgentText(readable);

        return {
          id: document.id,
          title: document.title,
          directoryId: document.directoryId,
          contentFormat: document.contentFormat,
          content: truncated.text,
          truncated: truncated.truncated,
          contentLength: truncated.contentLength,
        };
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
                typeof data.directoryId === 'string'
                  ? data.directoryId
                  : undefined,
            };
          })
          .filter((quiz) =>
            quiz.directoryId
              ? context.directoryIds.includes(quiz.directoryId)
              : true,
          );
      },
    },
    ...createQuizStatisticsToolDefinitions(context),
    {
      name: 'list_rules',
      description: 'List user rules.',
      parameters: { type: 'object', properties: {} },
      execute: async () => getRules(context.userId),
    },
    {
      name: 'create_directory',
      description:
        'Create a directory. In workspace scope, omit parentId to create at the workspace root; pass parentId to nest under an existing directory. In directory scope, omit parentId to create under the active directory. Directory names cannot contain / \\ : * ? " < > |; slashes in topics like AI/ML are converted to hyphens automatically.',
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
        const parentId = resolveCreateDirectoryParentId(context, args);
        const directory = await directoryService.createDirectory(
          context.userId,
          {
            name,
            parentId: parentId ?? undefined,
            description:
              typeof args.description === 'string'
                ? args.description
                : undefined,
          },
        );
        await AgentKnowledgeLifecycle.indexDirectory(
          context.userId,
          directory.id,
        );
        pushAction(context, {
          kind: 'create_directory',
          summary: `Created directory "${directory.name}" at ${directory.path}`,
          entityType: 'directory',
          entityId: directory.id,
        });
        return directory;
      },
    },
    {
      name: 'create_document',
      description:
        'Enqueue documentFromPrompt to generate a study document. Pass a generation prompt describing the document; do not write HTML or markdown yourself. Always-apply rules for the target directory are attached automatically.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          prompt: { type: 'string' },
          directoryId: { type: 'string' },
        },
        required: ['prompt'],
      },
      execute: async (args) => {
        const prompt = resolveCreateDocumentPrompt(args);
        const titleArg =
          typeof args.title === 'string' ? args.title.trim() : '';
        const directoryId =
          typeof args.directoryId === 'string'
            ? args.directoryId
            : await resolveDefaultDirectoryId(context);
        if (!prompt || !directoryId) {
          throw new Error('prompt and directoryId are required');
        }
        if (prompt.length < MIN_CREATE_DOCUMENT_PROMPT_CHARS) {
          throw new Error(
            `prompt must be at least ${MIN_CREATE_DOCUMENT_PROMPT_CHARS} characters`,
          );
        }
        assertDirectoryInScope(context, directoryId);
        const title = pendingTitleFromPrompt(prompt, titleArg || undefined);
        const { defaultRuleIds } = await getApplicableRules(
          context.userId,
          directoryId,
          RuleApplicability.PROMPT,
        );
        const usageReservation = await enforceCallableGenerationLimits(
          context.userId,
          'documentFromPrompt',
        );
        let pendingDocId: string | undefined;
        try {
          pendingDocId = await DocumentCrudService.createPendingDocument(
            context.userId,
            {
              directoryId,
              title,
              description: `Generated from prompt: ${prompt.substring(0, 100)}${
                prompt.length > 100 ? '...' : ''
              }`,
              sourceType: DocumentSourceType.GENERATED,
              tags: ['ai-generated', 'prompt-based'],
            },
          );
          const jobId = await enqueueGenerationJob({
            userId: context.userId,
            directoryId,
            recordId: pendingDocId,
            kind: 'documentFromPrompt',
            usageReservationId: usageReservation.id,
            payload: {
              sourceKind: 'prompt',
              prompt,
              title,
              directoryId,
              ruleIds: defaultRuleIds,
              ruleResolutionMode: 'explicit-only',
            },
          });
          pushAction(context, {
            kind: 'create_document',
            summary: `Started document generation for "${title}"`,
            entityType: 'document',
            entityId: pendingDocId,
            jobId,
          });
          return {
            id: pendingDocId,
            documentId: pendingDocId,
            title,
            jobId,
            generationStatus: 'pending',
            appliedAlwaysApplyRuleIds: defaultRuleIds,
          };
        } catch (error) {
          if (pendingDocId) {
            const message =
              error instanceof Error ? error.message : String(error);
            await DocumentCrudService.failPendingDocument(
              context.userId,
              pendingDocId,
              message,
            ).catch(() => undefined);
          }
          await refundUsageReservationSafe(context.userId, usageReservation.id);
          throw error;
        }
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
        const documentId =
          typeof args.documentId === 'string' ? args.documentId : '';
        if (!documentId) {
          throw new Error('documentId is required');
        }
        const document = await DocumentCrudService.getDocument(
          context.userId,
          documentId,
        );
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
          title:
            typeof args.title === 'string'
              ? args.title
              : `${document.title} Quiz`,
        });
        const jobId = await enqueueGenerationJob({
          userId: context.userId,
          directoryId: document.directoryId,
          recordId: quizId,
          kind: 'quiz',
          payload: {
            documentIds: [documentId],
            title:
              typeof args.title === 'string'
                ? args.title
                : `${document.title} Quiz`,
            questionCount:
              typeof args.questionCount === 'number'
                ? Math.min(args.questionCount, 20)
                : 10,
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
        const content =
          typeof args.content === 'string' ? args.content.trim() : '';
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
          description:
            typeof args.description === 'string' ? args.description : '',
          color:
            args.color === undefined
              ? RuleColor.PURPLE
              : (parseOptionalRuleColor(args.color) ?? RuleColor.PURPLE),
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
        const ruleId =
          typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
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
          if (
            typeof args.content !== 'string' ||
            args.content.trim().length === 0
          ) {
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
          updateRequest.applicableTo = parseOptionalRuleApplicabilityArray(
            args.applicableTo,
          );
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
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
        const ruleId = typeof args.ruleId === 'string' ? args.ruleId : '';
        if (!directoryId || !ruleId) {
          throw new Error('directoryId and ruleId are required');
        }
        assertDirectoryInScope(context, directoryId);
        await attachRuleToDirectory(context.userId, ruleId, directoryId);
        const directory = await directoryService.getDirectory(
          context.userId,
          directoryId,
        );
        const directoryLabel = directory?.path ?? directoryId;
        pushAction(context, {
          kind: 'attach_rule',
          summary: `Attached rule to ${directoryLabel}`,
          entityType: 'rule',
          entityId: ruleId,
        });
        return { directoryId, ruleId, directoryPath: directory?.path };
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
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
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
        const ruleId =
          typeof args.ruleId === 'string' ? args.ruleId.trim() : '';
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
        const directoryId =
          typeof args.directoryId === 'string' ? args.directoryId : '';
        const directory = await directoryService.getDirectory(
          context.userId,
          directoryId,
        );
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
      description:
        'Propose deleting one or more documents for user confirmation.',
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
          ? args.documentIds.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        for (const documentId of documentIds) {
          const document = await DocumentCrudService.getDocument(
            context.userId,
            documentId,
          );
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
  tools: AgentToolDefinition[],
): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
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
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.find((entry) => entry.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return tool.execute(args);
}

export function actionKindFromToolName(
  toolName: string,
): AgentActionKind | undefined {
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@study-forge/backend-directories/directory', () => ({
  directoryService: {
    getDirectory: vi.fn(),
    createDirectory: vi.fn(),
    validateDirectoryId: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-directories/rule-crud', () => ({
  attachRuleToDirectory: vi.fn(),
  createRule: vi.fn(),
  detachRuleFromDirectory: vi.fn(),
  getRule: vi.fn(),
  getRules: vi.fn(),
  updateRule: vi.fn(),
}));

vi.mock('@study-forge/backend-documents/document-crud', () => ({
  DocumentCrudService: {
    getDocument: vi.fn(),
    getDocumentWithContent: vi.fn(),
    createDocument: vi.fn(),
    createPendingDocument: vi.fn(),
    failPendingDocument: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-core/services/user-onboarding-service', () => ({
  claimStarterCourseDocument: vi.fn(),
  recordStarterCourseDirectory: vi.fn(),
  recordStarterCourseDocument: vi.fn(),
  releaseStarterCourseDocument: vi.fn(),
}));

vi.mock('./starter-course-tools', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./starter-course-tools')>()),
  attachStarterCourseRules: vi.fn(),
  waitForCooldown: vi.fn(),
}));

vi.mock('@study-forge/backend-generation/generation-enqueue', () => ({
  enqueueGenerationJob: vi.fn(),
}));

vi.mock('@study-forge/backend-generation/generation-limits', () => ({
  enforceCallableGenerationLimits: vi.fn(),
  refundUsageReservationSafe: vi.fn(),
}));

vi.mock('@study-forge/backend-artifacts/artifact-generation-records', () => ({
  createPendingQuiz: vi.fn(),
  failPendingQuiz: vi.fn(),
  createPendingFlashcardSet: vi.fn(),
  failPendingFlashcardSet: vi.fn(),
}));

vi.mock(
  '@study-forge/backend-generation/generation-job-payload-storage',
  () => ({
    GenerationJobPayloadStorage: {
      saveJson: vi.fn(),
    },
  }),
);

vi.mock('@study-forge/backend-generation/generation-jobs', () => ({
  GenerationJobsService: {
    newJobId: vi.fn(),
    createJob: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-generation/generation-task-queue', () => ({
  enqueueGenerationJobTask: vi.fn(),
}));

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    documents: vi.fn(),
    quizzes: vi.fn(),
    directoryItems: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-core/services/statistics', () => ({
  getStatisticsOverview: vi.fn(),
  getStatisticsQuizPerformance: vi.fn(),
  getStatisticsQuizDetail: vi.fn(),
}));

vi.mock('../knowledge/agent-knowledge-index-service', () => ({
  AgentKnowledgeIndexService: {
    searchKnowledge: vi.fn(),
  },
}));

vi.mock('../knowledge/agent-knowledge-lifecycle', () => ({
  AgentKnowledgeLifecycle: {
    indexDirectory: vi.fn(),
    indexDocument: vi.fn(),
    indexRule: vi.fn(),
  },
}));

import {
  DocumentSourceType,
  DocumentStatus,
  type DocumentEnhanced,
} from '@shared-types';
import { directoryService } from '@study-forge/backend-directories/directory';
import {
  attachRuleToDirectory,
  createRule,
  detachRuleFromDirectory,
  getRule,
  updateRule,
} from '@study-forge/backend-directories/rule-crud';
import { DocumentCrudService } from '@study-forge/backend-documents/document-crud';
import { enqueueGenerationJob } from '@study-forge/backend-generation/generation-enqueue';
import {
  enforceCallableGenerationLimits,
  refundUsageReservationSafe,
} from '@study-forge/backend-generation/generation-limits';
import type { IUsageReservation } from '@study-forge/backend-core/services/usage-limits-service';
import {
  createPendingQuiz,
  failPendingQuiz,
  createPendingFlashcardSet,
  failPendingFlashcardSet,
} from '@study-forge/backend-artifacts/artifact-generation-records';
import { GenerationJobPayloadStorage } from '@study-forge/backend-generation/generation-job-payload-storage';
import { GenerationJobsService } from '@study-forge/backend-generation/generation-jobs';
import { enqueueGenerationJobTask } from '@study-forge/backend-generation/generation-task-queue';
import { directoryService } from '@study-forge/backend-directories/directory';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  AGENT_MAX_REFERENCED_ITEMS,
  restoreReferencedItemsFromOutcomes,
  seedRuntimeContextFromTurn,
  createAgentToolDefinitions,
  executeAgentTool,
  resolveCreateDirectoryParentId,
  toAgentReadableDocumentContent,
  type AgentToolRuntimeContext,
} from './create-agent-tools';
import { AgentRequestAbortedError } from '../runner/agent-request-abort';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  claimStarterCourseDocument,
  recordStarterCourseDirectory,
  recordStarterCourseDocument,
  releaseStarterCourseDocument,
} from '@study-forge/backend-core/services/user-onboarding-service';
import {
  attachStarterCourseRules,
  waitForCooldown,
} from './starter-course-tools';

function createContext(
  overrides: Partial<AgentToolRuntimeContext> = {},
): AgentToolRuntimeContext {
  return {
    userId: 'user-1',
    scope: 'workspace',
    directoryIds: ['dir-1'],
    executedActions: [],
    proposedDeletes: [],
    referencedItems: [],
    seenItems: new Map(),
    generationBatchCounts: {
      documents: 0,
      quizzes: 0,
      flashcardSets: 0,
    },
    ...overrides,
  };
}

function createTestDocument(
  overrides: Partial<DocumentEnhanced> = {},
): DocumentEnhanced {
  return {
    id: 'doc-1',
    userId: 'user-1',
    title: 'Supervised Learning',
    description: '',
    sourceType: DocumentSourceType.GENERATED,
    wordCount: 10,
    status: DocumentStatus.ACTIVE,
    storageUrl: '',
    storagePath: 'users/user-1/documents/doc-1/content.html',
    tags: [],
    directoryId: 'dir-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createTestUsageReservation(
  overrides: Partial<IUsageReservation> = {},
): IUsageReservation {
  return {
    id: 'reservation-1',
    userId: 'user-1',
    userGroupId: 'group-1',
    usageLimitsSetupId: 'setup-1',
    llmSetupId: 'llm-1',
    generationKind: 'quiz',
    credits: 5,
    includedCredits: 5,
    overageCredits: 0,
    overageAmountCents: 0,
    periodKey: '2026-08',
    status: 'pending',
    createdAt: '2026-08-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('createAgentToolDefinitions rule tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls attachRuleToDirectory with ruleId before directoryId', async () => {
    vi.mocked(attachRuleToDirectory).mockResolvedValue(undefined);
    vi.mocked(directoryService.getDirectory).mockResolvedValue({
      id: 'dir-1',
      userId: 'user-1',
      name: 'Python',
      parentId: null,
      path: '/Python',
      level: 0,
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      ruleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = createContext();
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'attach_rule_to_directory', {
      directoryId: 'dir-1',
      ruleId: 'rule-1',
    });

    expect(attachRuleToDirectory).toHaveBeenCalledWith(
      'user-1',
      'rule-1',
      'dir-1',
    );
    expect(context.executedActions[0]?.summary).toBe(
      'Attached rule to /Python',
    );
  });

  it('calls detachRuleFromDirectory with ruleId before directoryId', async () => {
    vi.mocked(detachRuleFromDirectory).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'detach_rule_from_directory', {
      directoryId: 'dir-1',
      ruleId: 'rule-1',
    });

    expect(detachRuleFromDirectory).toHaveBeenCalledWith(
      'user-1',
      'rule-1',
      'dir-1',
    );
  });

  it('updates rule applicableTo to slide_deck', async () => {
    vi.mocked(updateRule).mockResolvedValue({
      id: 'brvpfEU3yMK3nBvGOq1Z',
      userId: 'user-1',
      name: 'Slide-Deck Generation',
      content: 'content',
      color: 'purple',
      tags: [],
      applicableTo: ['slide_deck'],
      isDefault: false,
      directoryIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tools = createAgentToolDefinitions(createContext());
    const result = await executeAgentTool(tools, 'update_rule', {
      ruleId: 'brvpfEU3yMK3nBvGOq1Z',
      applicableTo: ['slide_deck'],
    });

    expect(updateRule).toHaveBeenCalledWith('user-1', {
      ruleId: 'brvpfEU3yMK3nBvGOq1Z',
      applicableTo: ['slide_deck'],
    });
    expect(AgentKnowledgeLifecycle.indexRule).toHaveBeenCalledWith(
      'user-1',
      'brvpfEU3yMK3nBvGOq1Z',
    );
    expect(result).toMatchObject({ applicableTo: ['slide_deck'] });
  });

  it('proposes deleting a rule by id', async () => {
    vi.mocked(getRule).mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      name: 'Test Rule',
      content: 'content',
      color: 'purple',
      tags: [],
      applicableTo: ['quiz'],
      isDefault: false,
      directoryIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = createContext();
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'propose_delete_rule', {
      ruleId: 'rule-1',
      reason: 'No longer needed',
    });

    expect(context.proposedDeletes).toEqual([
      {
        targetType: 'rule',
        targetId: 'rule-1',
        label: 'Test Rule',
        reason: 'No longer needed',
      },
    ]);
  });

  it('creates a rule with explicit applicableTo', async () => {
    vi.mocked(createRule).mockResolvedValue({
      id: 'rule-new',
      userId: 'user-1',
      name: 'Slide Rule',
      content: 'instructions',
      color: 'purple',
      tags: [],
      applicableTo: ['slide_deck'],
      isDefault: false,
      directoryIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'create_rule', {
      name: 'Slide Rule',
      content: 'instructions',
      applicableTo: ['slide_deck'],
    });

    expect(createRule).toHaveBeenCalledWith('user-1', {
      name: 'Slide Rule',
      content: 'instructions',
      description: '',
      color: 'purple',
      tags: [],
      applicableTo: ['slide_deck'],
      isDefault: false,
    });
  });

  it('requires applicableTo', async () => {
    const tools = createAgentToolDefinitions(createContext());
    const createRuleTool = tools.find((tool) => tool.name === 'create_rule');
    expect(createRuleTool?.parameters.required).toContain('applicableTo');

    await expect(
      executeAgentTool(tools, 'create_rule', {
        name: 'Slide Rule',
        content: 'instructions',
      }),
    ).rejects.toThrow(/applicableTo is required/);
    expect(createRule).not.toHaveBeenCalled();
  });

  it('rejects retired applicability values', async () => {
    const tools = createAgentToolDefinitions(createContext());

    await expect(
      executeAgentTool(tools, 'create_rule', {
        name: 'Chat Rule',
        content: 'instructions',
        applicableTo: ['chat'],
      }),
    ).rejects.toThrow('Invalid applicability: chat');
    expect(createRule).not.toHaveBeenCalled();
  });
});

describe('createAgentToolDefinitions create_directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates at workspace root when parentId is omitted and nothing is open', async () => {
    vi.mocked(directoryService.createDirectory).mockResolvedValue({
      id: 'python-1',
      userId: 'user-1',
      name: 'Python',
      parentId: null,
      path: '/Python',
      level: 0,
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      ruleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const onEvent = vi.fn();
    const context = createContext({
      scope: 'workspace',
      directoryIds: ['aws-root', 'other-root'],
      onEvent,
    });
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'create_directory', { name: 'Python' });

    expect(directoryService.createDirectory).toHaveBeenCalledWith('user-1', {
      name: 'Python',
      parentId: undefined,
      description: undefined,
    });
    expect(context.executedActions[0]?.summary).toBe(
      'Created directory "Python" at /Python',
    );
    expect(onEvent).toHaveBeenCalledWith({
      type: 'status',
      message: 'Creating directory "Python"...',
    });
    expect(onEvent).toHaveBeenCalledWith({
      type: 'action',
      action: expect.objectContaining({
        kind: 'create_directory',
        summary: 'Created directory "Python" at /Python',
      }),
    });
  });

  it('nests under active directory in directory scope when parentId is omitted', async () => {
    vi.mocked(directoryService.createDirectory).mockResolvedValue({
      id: 'screenshots-1',
      userId: 'user-1',
      name: 'Screenshots',
      parentId: 'python-1',
      path: '/Python/Screenshots',
      level: 1,
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      ruleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = createContext({
      scope: 'directory',
      directoryId: 'python-1',
      directoryIds: ['python-1'],
    });
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'create_directory', { name: 'Screenshots' });

    expect(directoryService.createDirectory).toHaveBeenCalledWith('user-1', {
      name: 'Screenshots',
      parentId: 'python-1',
      description: undefined,
    });
  });

  it('uses explicit parentId when provided in workspace scope', async () => {
    vi.mocked(directoryService.createDirectory).mockResolvedValue({
      id: 'screenshots-1',
      userId: 'user-1',
      name: 'Screenshots',
      parentId: 'python-1',
      path: '/Python/Screenshots',
      level: 1,
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      ruleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const context = createContext({
      scope: 'workspace',
      directoryIds: ['python-1', 'aws-root'],
    });
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'create_directory', {
      name: 'Screenshots',
      parentId: 'python-1',
    });

    expect(directoryService.createDirectory).toHaveBeenCalledWith('user-1', {
      name: 'Screenshots',
      parentId: 'python-1',
      description: undefined,
    });
  });
});

describe('resolveCreateDirectoryParentId', () => {
  const viewingHealwith = {
    type: 'directory' as const,
    directoryId: 'healwith-1',
    path: '/Healwith',
  };

  it('nests inside the folder the user is viewing in workspace scope', () => {
    const context = createContext({ promptContext: viewingHealwith });
    expect(resolveCreateDirectoryParentId(context, { name: 'Locks' })).toBe(
      'healwith-1',
    );
  });

  it("nests inside the open document's folder", () => {
    const context = createContext({
      promptContext: {
        type: 'document',
        documentId: 'doc-1',
        directoryId: 'healwith-1',
      },
    });
    expect(resolveCreateDirectoryParentId(context, { name: 'Locks' })).toBe(
      'healwith-1',
    );
  });

  it('goes to the top level when nothing with a folder is open', () => {
    expect(
      resolveCreateDirectoryParentId(createContext(), { name: 'Locks' }),
    ).toBeUndefined();
    expect(
      resolveCreateDirectoryParentId(
        createContext({
          promptContext: { type: 'document', documentId: 'doc-1' },
        }),
        { name: 'Locks' },
      ),
    ).toBeUndefined();
    expect(
      resolveCreateDirectoryParentId(
        createContext({ promptContext: { type: 'rule', ruleId: 'rule-1' } }),
        { name: 'Locks' },
      ),
    ).toBeUndefined();
  });

  it('goes to the top level for an explicit root, even while viewing a folder', () => {
    const context = createContext({ promptContext: viewingHealwith });
    expect(
      resolveCreateDirectoryParentId(context, {
        name: 'Locks',
        parentId: 'root',
      }),
    ).toBeUndefined();
    expect(
      resolveCreateDirectoryParentId(context, {
        name: 'Locks',
        parentId: ' / ',
      }),
    ).toBeUndefined();
  });

  it('uses an explicit parentId over the viewed folder', () => {
    const context = createContext({ promptContext: viewingHealwith });
    expect(
      resolveCreateDirectoryParentId(context, {
        name: 'Locks',
        parentId: 'aws-1',
      }),
    ).toBe('aws-1');
  });

  it('refuses a top-level folder in directory scope', () => {
    const context = createContext({
      scope: 'directory',
      directoryId: 'python-1',
      directoryIds: ['python-1'],
    });
    expect(() =>
      resolveCreateDirectoryParentId(context, {
        name: 'Locks',
        parentId: 'root',
      }),
    ).toThrow('Directory scope cannot create a top-level directory');
  });

  it('stays in the active directory in directory scope, whatever the UI shows', () => {
    const context = createContext({
      scope: 'directory',
      directoryId: 'python-1',
      directoryIds: ['python-1'],
      promptContext: viewingHealwith,
    });
    expect(resolveCreateDirectoryParentId(context, { name: 'Locks' })).toBe(
      'python-1',
    );
  });
});

describe('createAgentToolDefinitions get_document_content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads document body and strips HTML', async () => {
    vi.mocked(DocumentCrudService.getDocumentWithContent).mockResolvedValue({
      ...createTestDocument({
        title: 'Using Tools with LangChain',
        contentFormat: 'html',
      }),
      content: '<h1>Tools</h1><p>Use <code>tool.bind()</code> carefully.</p>',
    });

    const tools = createAgentToolDefinitions(createContext());
    const result = await executeAgentTool(tools, 'get_document_content', {
      documentId: 'doc-1',
    });

    expect(DocumentCrudService.getDocumentWithContent).toHaveBeenCalledWith(
      'user-1',
      'doc-1',
    );
    expect(result).toMatchObject({
      id: 'doc-1',
      title: 'Using Tools with LangChain',
      directoryId: 'dir-1',
      truncated: false,
      content: 'Tools Use tool.bind() carefully.',
    });
  });

  it('defaults to UI document context when documentId is omitted', async () => {
    vi.mocked(DocumentCrudService.getDocumentWithContent).mockResolvedValue({
      ...createTestDocument({
        id: 'doc-ui',
        title: 'Current Doc',
        wordCount: 3,
        storagePath: 'users/user-1/documents/doc-ui/content.html',
        contentFormat: 'markdown',
      }),
      content: 'plain source text',
    });

    const tools = createAgentToolDefinitions(
      createContext({
        promptContext: {
          type: 'document',
          documentId: 'doc-ui',
          directoryId: 'dir-1',
          label: 'Current Doc',
        },
      }),
    );
    const result = await executeAgentTool(tools, 'get_document_content', {});

    expect(DocumentCrudService.getDocumentWithContent).toHaveBeenCalledWith(
      'user-1',
      'doc-ui',
    );
    expect(result).toMatchObject({
      id: 'doc-ui',
      content: 'plain source text',
    });
  });

  it('rejects missing documentId without document UI context', async () => {
    const tools = createAgentToolDefinitions(createContext());
    await expect(
      executeAgentTool(tools, 'get_document_content', {}),
    ).rejects.toThrow(/documentId is required/);
  });
});

describe('toAgentReadableDocumentContent', () => {
  it('strips html tags', () => {
    expect(
      toAgentReadableDocumentContent('<p>Hello <b>world</b></p>', 'html'),
    ).toBe('Hello world');
  });
});

describe('createAgentToolDefinitions create_document', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues documentFromPrompt with inherited directory rules', async () => {
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({
        id: 'reservation-1',
        generationKind: 'documentFromPrompt',
        credits: 20,
        includedCredits: 20,
      }),
    );
    vi.mocked(DocumentCrudService.createPendingDocument).mockResolvedValue(
      'doc-pending',
    );
    vi.mocked(enqueueGenerationJob).mockResolvedValue('job-1');

    const context = createContext({ directoryIds: ['dir-1'] });
    const tools = createAgentToolDefinitions(context);
    const result = await executeAgentTool(tools, 'create_document', {
      title: 'LangGraph Recap',
      prompt: 'Write a recap of quiz gaps with mermaid diagrams.',
      directoryId: 'dir-1',
    });

    expect(DocumentCrudService.createDocument).not.toHaveBeenCalled();
    expect(DocumentCrudService.createPendingDocument).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        directoryId: 'dir-1',
        title: 'LangGraph Recap',
        sourceType: 'generated',
      }),
    );
    expect(enqueueGenerationJob).toHaveBeenCalledWith({
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'doc-pending',
      kind: 'documentFromPrompt',
      usageReservationId: 'reservation-1',
      payload: {
        sourceKind: 'prompt',
        prompt: 'Write a recap of quiz gaps with mermaid diagrams.',
        title: 'LangGraph Recap',
        directoryId: 'dir-1',
        ruleResolutionMode: 'inherit-plus-explicit',
      },
    });
    expect(AgentKnowledgeLifecycle.indexDocument).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'doc-pending',
      documentId: 'doc-pending',
      title: 'LangGraph Recap',
      jobId: 'job-1',
      generationStatus: 'pending',
      ruleResolutionMode: 'inherit-plus-explicit',
    });
    expect(context.executedActions[0]?.summary).toBe(
      'Started document generation for "LangGraph Recap"',
    );
  });

  it('accepts text as an alias for prompt', async () => {
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({
        id: 'reservation-1',
        generationKind: 'documentFromPrompt',
        credits: 20,
        includedCredits: 20,
      }),
    );
    vi.mocked(DocumentCrudService.createPendingDocument).mockResolvedValue(
      'doc-pending',
    );
    vi.mocked(enqueueGenerationJob).mockResolvedValue('job-1');

    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'create_document', {
      text: 'Create a recap covering yesterday quiz gaps.',
    });

    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          prompt: 'Create a recap covering yesterday quiz gaps.',
        }),
      }),
    );
  });

  it('does not reserve usage when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const tools = createAgentToolDefinitions(
      createContext({ abortSignal: controller.signal }),
    );

    await expect(
      executeAgentTool(tools, 'create_document', {
        title: 'LangGraph Recap',
        prompt: 'Write a recap of quiz gaps with mermaid diagrams.',
        directoryId: 'dir-1',
      }),
    ).rejects.toThrow(AgentRequestAbortedError);

    expect(enforceCallableGenerationLimits).not.toHaveBeenCalled();
    expect(enqueueGenerationJob).not.toHaveBeenCalled();
  });

  it('refunds the reservation and skips enqueue when abort happens after reserve', async () => {
    const controller = new AbortController();
    vi.mocked(enforceCallableGenerationLimits).mockImplementation(async () => {
      controller.abort();
      return createTestUsageReservation({
        id: 'reservation-1',
        generationKind: 'documentFromPrompt',
        credits: 20,
        includedCredits: 20,
      });
    });
    vi.mocked(refundUsageReservationSafe).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(
      createContext({ abortSignal: controller.signal }),
    );

    await expect(
      executeAgentTool(tools, 'create_document', {
        title: 'LangGraph Recap',
        prompt: 'Write a recap of quiz gaps with mermaid diagrams.',
        directoryId: 'dir-1',
      }),
    ).rejects.toThrow(AgentRequestAbortedError);

    expect(DocumentCrudService.createPendingDocument).not.toHaveBeenCalled();
    expect(enqueueGenerationJob).not.toHaveBeenCalled();
    expect(refundUsageReservationSafe).toHaveBeenCalledWith(
      'user-1',
      'reservation-1',
    );
  });
});

describe('createAgentToolDefinitions generate_quiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves quiz credits and attaches the reservation to the job', async () => {
    vi.mocked(DocumentCrudService.getDocument).mockResolvedValue(
      createTestDocument(),
    );
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({ id: 'quiz-reservation-1' }),
    );
    vi.mocked(createPendingQuiz).mockResolvedValue('quiz-pending');
    vi.mocked(enqueueGenerationJob).mockResolvedValue('quiz-job-1');

    const context = createContext({ directoryIds: ['dir-1'] });
    const tools = createAgentToolDefinitions(context);
    const result = await executeAgentTool(tools, 'generate_quiz', {
      documentId: 'doc-1',
      title: 'Supervised Learning Quiz',
      questionCount: 8,
    });

    expect(enforceCallableGenerationLimits).toHaveBeenCalledWith(
      'user-1',
      'quiz',
    );
    expect(createPendingQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        directoryId: 'dir-1',
        documentId: 'doc-1',
        title: 'Supervised Learning Quiz',
      }),
    );
    expect(enqueueGenerationJob).toHaveBeenCalledWith({
      userId: 'user-1',
      directoryId: 'dir-1',
      recordId: 'quiz-pending',
      kind: 'quiz',
      usageReservationId: 'quiz-reservation-1',
      payload: {
        documentIds: ['doc-1'],
        title: 'Supervised Learning Quiz',
        questionCount: 8,
      },
    });
    expect(result).toEqual({ quizId: 'quiz-pending', jobId: 'quiz-job-1' });
    expect(context.executedActions[0]?.summary).toBe(
      'Started quiz generation for "Supervised Learning"',
    );
  });

  it('does not create a pending quiz when credit reservation fails', async () => {
    vi.mocked(DocumentCrudService.getDocument).mockResolvedValue(
      createTestDocument(),
    );
    vi.mocked(enforceCallableGenerationLimits).mockRejectedValue(
      new Error('You do not have enough credits for this action.'),
    );

    const tools = createAgentToolDefinitions(createContext());
    await expect(
      executeAgentTool(tools, 'generate_quiz', { documentId: 'doc-1' }),
    ).rejects.toThrow('enough credits');

    expect(createPendingQuiz).not.toHaveBeenCalled();
    expect(enqueueGenerationJob).not.toHaveBeenCalled();
  });

  it('refunds the reservation and fails the pending quiz when enqueue fails', async () => {
    vi.mocked(DocumentCrudService.getDocument).mockResolvedValue(
      createTestDocument(),
    );
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({ id: 'quiz-reservation-1' }),
    );
    vi.mocked(createPendingQuiz).mockResolvedValue('quiz-pending');
    vi.mocked(enqueueGenerationJob).mockRejectedValue(
      new Error('queue unavailable'),
    );
    vi.mocked(failPendingQuiz).mockResolvedValue(undefined);
    vi.mocked(refundUsageReservationSafe).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(createContext());
    await expect(
      executeAgentTool(tools, 'generate_quiz', { documentId: 'doc-1' }),
    ).rejects.toThrow('queue unavailable');

    expect(failPendingQuiz).toHaveBeenCalledWith(
      'user-1',
      'quiz-pending',
      'queue unavailable',
    );
    expect(refundUsageReservationSafe).toHaveBeenCalledWith(
      'user-1',
      'quiz-reservation-1',
    );
  });

  it('refunds the reservation and skips enqueue when abort happens after reserve', async () => {
    const controller = new AbortController();
    vi.mocked(DocumentCrudService.getDocument).mockResolvedValue(
      createTestDocument(),
    );
    vi.mocked(enforceCallableGenerationLimits).mockImplementation(async () => {
      controller.abort();
      return createTestUsageReservation({ id: 'quiz-reservation-1' });
    });
    vi.mocked(refundUsageReservationSafe).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(
      createContext({ abortSignal: controller.signal }),
    );

    await expect(
      executeAgentTool(tools, 'generate_quiz', { documentId: 'doc-1' }),
    ).rejects.toThrow(AgentRequestAbortedError);

    expect(createPendingQuiz).not.toHaveBeenCalled();
    expect(enqueueGenerationJob).not.toHaveBeenCalled();
    expect(refundUsageReservationSafe).toHaveBeenCalledWith(
      'user-1',
      'quiz-reservation-1',
    );
  });
});

describe('createAgentToolDefinitions generate_flashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves flashcard credits and enqueues an artifactAgent job', async () => {
    vi.mocked(DocumentCrudService.getDocumentWithContent).mockResolvedValue(
      createTestDocument({ content: '# Notes\nContent' }),
    );
    vi.mocked(directoryService.validateDirectoryId).mockResolvedValue(
      undefined,
    );
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({ id: 'flashcard-reservation-1' }),
    );
    vi.mocked(createPendingFlashcardSet).mockResolvedValue('flashcard-pending');
    vi.mocked(GenerationJobsService.newJobId).mockReturnValue(
      'flashcard-job-1',
    );
    vi.mocked(GenerationJobPayloadStorage.saveJson).mockResolvedValue(
      'users/user-1/generationJobs/flashcard-job-1/payload.json',
    );
    vi.mocked(GenerationJobsService.createJob).mockResolvedValue(undefined);
    vi.mocked(enqueueGenerationJobTask).mockResolvedValue(undefined);

    const context = createContext({ directoryIds: ['dir-1'] });
    const tools = createAgentToolDefinitions(context);
    const result = await executeAgentTool(tools, 'generate_flashcards', {
      documentIds: ['doc-1'],
      title: 'Key Terms',
    });

    expect(enforceCallableGenerationLimits).toHaveBeenCalledWith(
      'user-1',
      'flashcards',
    );
    expect(createPendingFlashcardSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        directoryId: 'dir-1',
        documentId: 'doc-1',
        title: 'Key Terms',
      }),
    );
    expect(GenerationJobsService.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'flashcard-job-1',
        kind: 'artifactAgent',
        artifactKind: 'flashcards',
        usageReservationId: 'flashcard-reservation-1',
      }),
    );
    expect(result).toEqual({
      flashcardSetId: 'flashcard-pending',
      jobId: 'flashcard-job-1',
    });
    expect(context.generationBatchCounts.flashcardSets).toBe(1);
  });

  it('refunds flashcard credits when enqueue fails', async () => {
    vi.mocked(DocumentCrudService.getDocumentWithContent).mockResolvedValue(
      createTestDocument({ content: '# Notes\nContent' }),
    );
    vi.mocked(directoryService.validateDirectoryId).mockResolvedValue(
      undefined,
    );
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({ id: 'flashcard-reservation-1' }),
    );
    vi.mocked(createPendingFlashcardSet).mockResolvedValue('flashcard-pending');
    vi.mocked(GenerationJobsService.newJobId).mockReturnValue(
      'flashcard-job-1',
    );
    vi.mocked(GenerationJobPayloadStorage.saveJson).mockRejectedValue(
      new Error('queue unavailable'),
    );
    vi.mocked(failPendingFlashcardSet).mockResolvedValue(undefined);
    vi.mocked(refundUsageReservationSafe).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(createContext());
    await expect(
      executeAgentTool(tools, 'generate_flashcards', {
        documentIds: ['doc-1'],
      }),
    ).rejects.toThrow('queue unavailable');

    expect(failPendingFlashcardSet).toHaveBeenCalledWith(
      'user-1',
      'flashcard-pending',
      'queue unavailable',
    );
    expect(refundUsageReservationSafe).toHaveBeenCalledWith(
      'user-1',
      'flashcard-reservation-1',
    );
  });
});

describe('createAgentToolDefinitions present_items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockDirectoryItems(rows: Array<Record<string, unknown>>): void {
    const get = vi.fn().mockResolvedValue({
      docs: rows.map((row, index) => ({
        id: `item-${index}`,
        data: () => row,
      })),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore query mock boundary
    vi.mocked(FirestorePaths.directoryItems).mockReturnValue({ get } as any);
  }

  it('presents artifacts returned by list_artifacts and emits reference events', async () => {
    mockDirectoryItems([
      { itemType: 'flashcard', sourceId: 'fc-1', title: 'Organelles' },
      { itemType: 'document', sourceId: 'doc-1', title: 'Notes' },
      { itemType: 'subdirectory', sourceId: 'dir-2', title: 'Child' },
    ]);
    const onEvent = vi.fn();
    const context = createContext({ onEvent });
    const tools = createAgentToolDefinitions(context);

    const listed = await executeAgentTool(tools, 'list_artifacts', {});
    expect(listed).toEqual([
      expect.objectContaining({
        itemType: 'flashcard',
        id: 'fc-1',
        title: 'Organelles',
        directoryId: 'dir-1',
      }),
    ]);

    const result = await executeAgentTool(tools, 'present_items', {
      items: [{ itemType: 'flashcard', id: 'fc-1' }],
    });

    expect(result).toMatchObject({ presented: [{ id: 'fc-1' }], rejected: [] });
    expect(context.referencedItems).toEqual([
      {
        itemType: 'flashcard',
        id: 'fc-1',
        title: 'Organelles',
        directoryId: 'dir-1',
      },
    ]);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'reference',
      item: {
        itemType: 'flashcard',
        id: 'fc-1',
        title: 'Organelles',
        directoryId: 'dir-1',
      },
    });
  });

  it('rejects ids that no tool returned this turn', async () => {
    const context = createContext();
    const tools = createAgentToolDefinitions(context);

    const result = await executeAgentTool(tools, 'present_items', {
      items: [{ itemType: 'document', id: 'invented-id' }],
    });

    expect(result).toMatchObject({
      presented: [],
      rejected: ['document:invented-id'],
    });
    expect(context.referencedItems).toEqual([]);
  });

  it('presents a document read with get_document_content once, even if requested twice', async () => {
    vi.mocked(DocumentCrudService.getDocumentWithContent).mockResolvedValue({
      ...createTestDocument({ title: 'Mitochondria' }),
      content: 'ATP',
    });
    const context = createContext();
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'get_document_content', {
      documentId: 'doc-1',
    });

    await executeAgentTool(tools, 'present_items', {
      items: [
        { itemType: 'document', id: 'doc-1' },
        { itemType: 'document', id: 'doc-1' },
      ],
    });

    expect(context.referencedItems).toEqual([
      {
        itemType: 'document',
        id: 'doc-1',
        title: 'Mitochondria',
        directoryId: 'dir-1',
      },
    ]);
  });

  it('caps presented items per turn', async () => {
    mockDirectoryItems(
      Array.from({ length: AGENT_MAX_REFERENCED_ITEMS + 3 }, (_, index) => ({
        itemType: 'quiz',
        sourceId: `quiz-${index}`,
        title: `Quiz ${index}`,
      })),
    );
    const context = createContext();
    const tools = createAgentToolDefinitions(context);
    await executeAgentTool(tools, 'list_artifacts', {});

    await executeAgentTool(tools, 'present_items', {
      items: Array.from(
        { length: AGENT_MAX_REFERENCED_ITEMS + 3 },
        (_, index) => ({
          itemType: 'quiz',
          id: `quiz-${index}`,
        }),
      ),
    });

    expect(context.referencedItems).toHaveLength(AGENT_MAX_REFERENCED_ITEMS);
  });

  it('reports items dropped by the per-reply cap', async () => {
    mockDirectoryItems(
      Array.from({ length: AGENT_MAX_REFERENCED_ITEMS + 2 }, (_, index) => ({
        itemType: 'quiz',
        sourceId: `quiz-${index}`,
        title: `Quiz ${index}`,
      })),
    );
    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'list_artifacts', {});

    const result = await executeAgentTool(tools, 'present_items', {
      items: Array.from(
        { length: AGENT_MAX_REFERENCED_ITEMS + 2 },
        (_, index) => ({
          itemType: 'quiz',
          id: `quiz-${index}`,
        }),
      ),
    });

    expect(result).toMatchObject({
      overLimit: [
        `quiz:quiz-${AGENT_MAX_REFERENCED_ITEMS}`,
        `quiz:quiz-${AGENT_MAX_REFERENCED_ITEMS + 1}`,
      ],
    });
  });

  it('rejects list_artifacts for an unknown directory even in workspace scope', async () => {
    const tools = createAgentToolDefinitions(
      createContext({ scope: 'workspace', directoryIds: ['dir-1'] }),
    );

    await expect(
      executeAgentTool(tools, 'list_artifacts', {
        directoryId: 'dir-1/items/x',
      }),
    ).rejects.toThrow('outside the active agent scope');
  });

  it('restores seen and presented items from checkpointed outcomes after a resume', async () => {
    const context = createContext();
    restoreReferencedItemsFromOutcomes(context, [
      {
        name: 'list_artifacts',
        ok: true,
        result: [
          {
            itemType: 'flashcard',
            id: 'fc-1',
            title: 'Organelles',
            directoryId: 'dir-1',
          },
        ],
      },
      {
        name: 'list_documents',
        ok: true,
        result: [{ id: 'doc-1', title: 'Mitochondria', directoryId: 'dir-1' }],
      },
      {
        name: 'present_items',
        ok: true,
        result: {
          presented: [
            { itemType: 'flashcard', id: 'fc-1', title: 'Organelles' },
          ],
        },
      },
      { name: 'list_documents', ok: false, error: 'boom' },
      'not-an-outcome',
    ]);

    expect(context.referencedItems).toEqual([
      {
        itemType: 'flashcard',
        id: 'fc-1',
        title: 'Organelles',
        directoryId: 'dir-1',
      },
    ]);

    const tools = createAgentToolDefinitions(context);
    const result = await executeAgentTool(tools, 'present_items', {
      items: [{ itemType: 'document', id: 'doc-1' }],
    });
    expect(result).toMatchObject({
      presented: [{ id: 'doc-1' }],
      rejected: [],
    });
  });

  it('rejects list_artifacts for a directory outside directory scope', async () => {
    const context = createContext({
      scope: 'directory',
      directoryIds: ['dir-1'],
    });
    const tools = createAgentToolDefinitions(context);

    await expect(
      executeAgentTool(tools, 'list_artifacts', { directoryId: 'other-dir' }),
    ).rejects.toThrow('outside the active agent scope');
  });
});

describe('seedRuntimeContextFromTurn', () => {
  it('restores lists and generation counts from an earlier attempt', () => {
    const context = {
      executedActions: [],
      proposedDeletes: [],
      referencedItems: [],
      seenItems: new Map(),
      generationBatchCounts: { documents: 0, quizzes: 0, flashcardSets: 0 },
    };

    seedRuntimeContextFromTurn(context, {
      executedActions: [
        { kind: 'create_document', summary: 'Doc A', entityId: 'doc-a' },
        { kind: 'create_document', summary: 'Doc B', entityId: 'doc-b' },
        { kind: 'generate_quiz', summary: 'Quiz', entityId: 'quiz-1' },
        { kind: 'create_directory', summary: 'Folder', entityId: 'dir-1' },
      ],
      proposedDeletes: [
        { targetType: 'document', targetId: 'doc-old', label: 'Old doc' },
      ],
      referencedItems: [
        { itemType: 'document', id: 'doc-a', title: 'Doc A' },
        { itemType: 'document', id: 'doc-a', title: 'Doc A' },
      ],
    });

    expect(context.generationBatchCounts).toEqual({
      documents: 2,
      quizzes: 1,
      flashcardSets: 0,
    });
    expect(context.executedActions).toHaveLength(4);
    expect(context.proposedDeletes).toHaveLength(1);
    expect(context.referencedItems).toEqual([
      { itemType: 'document', id: 'doc-a', title: 'Doc A' },
    ]);
    expect(context.seenItems.has('document:doc-a')).toBe(true);
  });
});

describe('starter course tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceCallableGenerationLimits).mockResolvedValue(
      createTestUsageReservation({
        id: 'reservation-free',
        generationKind: 'documentFromPrompt',
        credits: 0,
        includedCredits: 0,
      }),
    );
    vi.mocked(DocumentCrudService.createPendingDocument).mockResolvedValue(
      'doc-starter',
    );
    vi.mocked(enqueueGenerationJob).mockResolvedValue('job-starter');
    vi.mocked(claimStarterCourseDocument).mockResolvedValue({ allowed: true });
  });

  function starterContext(
    starter: Partial<NonNullable<AgentToolRuntimeContext['starterCourse']>> = {},
  ): AgentToolRuntimeContext {
    return createContext({
      directoryIds: ['sample-dir'],
      starterCourse: {
        threadId: 'thread-starter',
        sampleDirectoryId: 'sample-dir',
        directoryId: 'course-dir',
        documentsRemaining: 2,
        ...starter,
      },
    });
  }

  const prompt = 'A beginner overview of Spanish greetings and pronunciation.';

  it('hides quiz and flashcard tools', () => {
    const names = createAgentToolDefinitions(starterContext()).map(
      (tool) => tool.name,
    );
    expect(names).not.toContain('generate_quiz');
    expect(names).not.toContain('generate_flashcards');
    expect(names).toContain('create_document');
  });

  it('creates a free document in the course folder by default', async () => {
    const context = starterContext();
    await executeAgentTool(createAgentToolDefinitions(context), 'create_document', {
      title: 'Spanish basics',
      prompt,
    });

    expect(claimStarterCourseDocument).toHaveBeenCalledWith(
      'user-1',
      'thread-starter',
    );
    expect(enforceCallableGenerationLimits).toHaveBeenCalledWith(
      'user-1',
      'documentFromPrompt',
      undefined,
      { waiver: { reason: 'starter_course' } },
    );
    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        directoryId: 'course-dir',
        usageReservationId: 'reservation-free',
      }),
    );
    expect(recordStarterCourseDocument).toHaveBeenCalledWith(
      'user-1',
      'doc-starter',
    );
    expect(context.starterCourse?.documentsRemaining).toBe(1);
  });

  it('refuses the sample folder', async () => {
    await expect(
      executeAgentTool(
        createAgentToolDefinitions(starterContext()),
        'create_document',
        { prompt, directoryId: 'sample-dir' },
      ),
    ).rejects.toThrow('sample folder');
    expect(claimStarterCourseDocument).not.toHaveBeenCalled();
  });

  it('refuses a document beyond the free allowance', async () => {
    vi.mocked(claimStarterCourseDocument).mockResolvedValue({
      allowed: false,
      message: 'The starter course already has its 2 free documents.',
    });
    await expect(
      executeAgentTool(
        createAgentToolDefinitions(starterContext()),
        'create_document',
        { prompt },
      ),
    ).rejects.toThrow('2 free documents');
    expect(enforceCallableGenerationLimits).not.toHaveBeenCalled();
  });

  it('gives the slot back when the document cannot be queued', async () => {
    vi.mocked(enqueueGenerationJob).mockRejectedValue(new Error('queue down'));
    vi.mocked(DocumentCrudService.failPendingDocument).mockResolvedValue(undefined);
    vi.mocked(releaseStarterCourseDocument).mockResolvedValue(undefined);
    await expect(
      executeAgentTool(
        createAgentToolDefinitions(starterContext()),
        'create_document',
        { prompt },
      ),
    ).rejects.toThrow('queue down');
    expect(releaseStarterCourseDocument).toHaveBeenCalledWith(
      'user-1',
      'thread-starter',
    );
    expect(recordStarterCourseDocument).not.toHaveBeenCalled();
  });

  it('waits out a short cooldown once, then retries', async () => {
    vi.mocked(enforceCallableGenerationLimits)
      .mockRejectedValueOnce(
        new HttpsError('resource-exhausted', 'Slow down', {
          retryAfterSeconds: 8,
        }),
      )
      .mockResolvedValueOnce(
        createTestUsageReservation({
          id: 'reservation-retry',
          generationKind: 'documentFromPrompt',
          credits: 0,
          includedCredits: 0,
        }),
      );
    await executeAgentTool(
      createAgentToolDefinitions(starterContext()),
      'create_document',
      { prompt },
    );
    expect(waitForCooldown).toHaveBeenCalledWith(8, undefined);
    expect(enforceCallableGenerationLimits).toHaveBeenCalledTimes(2);
    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({ usageReservationId: 'reservation-retry' }),
    );
  });

  it('records the course folder and attaches the formatting rules', async () => {
    vi.mocked(directoryService.createDirectory).mockResolvedValue({
      id: 'course-dir',
      userId: 'user-1',
      name: 'Spanish',
      parentId: null,
      path: '/Spanish',
      level: 0,
      documentCount: 0,
      childCount: 0,
      quizCount: 0,
      flashcardSetCount: 0,
      slideDeckCount: 0,
      ruleIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(recordStarterCourseDirectory).mockResolvedValue(true);
    const context = starterContext({ directoryId: undefined });
    await executeAgentTool(createAgentToolDefinitions(context), 'create_directory', {
      name: 'Spanish',
      parentId: 'root',
    });
    expect(recordStarterCourseDirectory).toHaveBeenCalledWith(
      'user-1',
      'thread-starter',
      'course-dir',
    );
    expect(attachStarterCourseRules).toHaveBeenCalledWith('user-1', 'course-dir');
    expect(context.starterCourse?.directoryId).toBe('course-dir');
  });
});

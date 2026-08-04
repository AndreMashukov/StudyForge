import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@study-forge/backend-directories/directory', () => ({
  directoryService: {
    getDirectory: vi.fn(),
    createDirectory: vi.fn(),
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
    createDocument: vi.fn(),
  },
}));

vi.mock('@study-forge/backend-documents/document-html/html-utils', () => ({
  normalizeGeneratedHtml: vi.fn(),
  wrapHtmlDocument: vi.fn(),
}));

vi.mock('@study-forge/backend-documents/document-html', () => ({
  prepareHtmlDocumentForStorage: vi.fn(),
}));

vi.mock('@study-forge/backend-generation/generation-enqueue', () => ({
  enqueueGenerationJob: vi.fn(),
}));

vi.mock('@study-forge/backend-artifacts/artifact-generation-records', () => ({
  createPendingQuiz: vi.fn(),
}));

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    documents: vi.fn(),
    quizzes: vi.fn(),
  },
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
  attachRuleToDirectory,
  createRule,
  detachRuleFromDirectory,
  getRule,
  updateRule,
} from '@study-forge/backend-directories/rule-crud';
import { AgentKnowledgeLifecycle } from '../knowledge/agent-knowledge-lifecycle';
import {
  createAgentToolDefinitions,
  executeAgentTool,
  type AgentToolRuntimeContext,
} from './create-agent-tools';

function createContext(): AgentToolRuntimeContext {
  return {
    userId: 'user-1',
    scope: 'workspace',
    directoryIds: ['dir-1'],
    executedActions: [],
    proposedDeletes: [],
  };
}

describe('createAgentToolDefinitions rule tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls attachRuleToDirectory with ruleId before directoryId', async () => {
    vi.mocked(attachRuleToDirectory).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'attach_rule_to_directory', {
      directoryId: 'dir-1',
      ruleId: 'rule-1',
    });

    expect(attachRuleToDirectory).toHaveBeenCalledWith('user-1', 'rule-1', 'dir-1');
  });

  it('calls detachRuleFromDirectory with ruleId before directoryId', async () => {
    vi.mocked(detachRuleFromDirectory).mockResolvedValue(undefined);

    const tools = createAgentToolDefinitions(createContext());
    await executeAgentTool(tools, 'detach_rule_from_directory', {
      directoryId: 'dir-1',
      ruleId: 'rule-1',
    });

    expect(detachRuleFromDirectory).toHaveBeenCalledWith('user-1', 'rule-1', 'dir-1');
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
      'brvpfEU3yMK3nBvGOq1Z'
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
      applicableTo: ['chat'],
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
});

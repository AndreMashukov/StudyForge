import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleApplicability, RuleColor } from '@shared-types';

vi.mock('@study-forge/backend-core/lib/firestore-paths', () => ({
  FirestorePaths: {
    platformRuleBlueprints: vi.fn(),
    platformRuleBlueprint: vi.fn(),
    rule: vi.fn(),
  },
}));

vi.mock('./rule-crud', () => ({
  createRule: vi.fn(),
  attachRuleToDirectory: vi.fn(),
}));

import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import { attachRuleToDirectory, createRule } from './rule-crud';
import {
  createRuleFromBlueprint,
  searchRuleBlueprints,
} from './rule-blueprints';

const publishedBlueprint = {
  id: 'bp-quiz-generic',
  name: 'Quiz Generic',
  description: 'Quiz standards',
  content: '# Quiz rules\nAlways explain answers.',
  color: RuleColor.ORANGE,
  tags: ['quiz'],
  applicableTo: [RuleApplicability.QUIZ],
  status: 'published' as const,
  version: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('rule-blueprints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searchRuleBlueprints filters by applicability and query', async () => {
    const get = vi.fn().mockResolvedValue({
      docs: [
        {
          id: publishedBlueprint.id,
          data: () => publishedBlueprint,
        },
      ],
    });
    const where = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({ get }),
    });

    vi.mocked(FirestorePaths.platformRuleBlueprints).mockReturnValue({
      where,
    } as never);

    const results = await searchRuleBlueprints({
      query: 'quiz',
      applicableTo: RuleApplicability.QUIZ,
    });

    expect(where).toHaveBeenCalledWith('status', '==', 'published');
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Quiz Generic');
  });

  it('createRuleFromBlueprint copies provenance metadata', async () => {
    vi.mocked(FirestorePaths.platformRuleBlueprint).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: publishedBlueprint.id,
        data: () => publishedBlueprint,
      }),
    } as never);

    vi.mocked(createRule).mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      name: 'My Quiz Rule',
      content: 'Custom quiz content',
      color: RuleColor.ORANGE,
      tags: ['quiz'],
      applicableTo: [RuleApplicability.QUIZ],
      isDefault: false,
      directoryIds: [],
      sourceBlueprintId: publishedBlueprint.id,
      sourceBlueprintVersion: 2,
      sourceBlueprintName: publishedBlueprint.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rule = await createRuleFromBlueprint('user-1', {
      blueprintId: publishedBlueprint.id,
      name: 'My Quiz Rule',
      content: 'Custom quiz content',
    });

    expect(createRule).toHaveBeenCalledWith('user-1', {
      name: 'My Quiz Rule',
      content: 'Custom quiz content',
      description: 'Quiz standards',
      color: RuleColor.ORANGE,
      tags: ['quiz'],
      applicableTo: [RuleApplicability.QUIZ],
      isDefault: false,
      sourceBlueprintId: publishedBlueprint.id,
      sourceBlueprintVersion: 2,
      sourceBlueprintName: 'Quiz Generic',
    });
    expect(rule.id).toBe('rule-1');
    expect(attachRuleToDirectory).not.toHaveBeenCalled();
  });

  it('createRuleFromBlueprint attaches to directory when requested', async () => {
    vi.mocked(FirestorePaths.platformRuleBlueprint).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: publishedBlueprint.id,
        data: () => publishedBlueprint,
      }),
    } as never);

    vi.mocked(createRule).mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      name: 'My Quiz Rule',
      content: 'Custom quiz content',
      color: RuleColor.ORANGE,
      tags: ['quiz'],
      applicableTo: [RuleApplicability.QUIZ],
      isDefault: false,
      directoryIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(FirestorePaths.rule).mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'rule-1',
          userId: 'user-1',
          name: 'My Quiz Rule',
          content: 'Custom quiz content',
          color: RuleColor.ORANGE,
          tags: ['quiz'],
          applicableTo: [RuleApplicability.QUIZ],
          isDefault: false,
          directoryIds: ['dir-1'],
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        }),
      }),
    } as never);

    await createRuleFromBlueprint('user-1', {
      blueprintId: publishedBlueprint.id,
      name: 'My Quiz Rule',
      content: 'Custom quiz content',
      directoryId: 'dir-1',
    });

    expect(attachRuleToDirectory).toHaveBeenCalledWith(
      'user-1',
      'rule-1',
      'dir-1',
    );
  });
});

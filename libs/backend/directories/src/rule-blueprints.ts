import {
  ICreateRuleFromBlueprintRequest,
  IRuleBlueprint,
  IRuleBlueprintSummary,
  ISearchRuleBlueprintsRequest,
  Rule,
  RuleBlueprintStatus,
} from '@shared-types';
import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';
import {
  attachRuleToDirectory,
  createRule,
} from './rule-crud';

const PUBLISHED_STATUS: RuleBlueprintStatus = 'published';
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

function parseBlueprint(
  id: string,
  data: FirebaseFirestore.DocumentData,
): IRuleBlueprint | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const content = typeof data.content === 'string' ? data.content : '';
  const color = data.color;
  const status = data.status;
  const applicableTo = Array.isArray(data.applicableTo) ? data.applicableTo : [];
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const version = typeof data.version === 'number' ? data.version : 1;

  if (
    !name ||
    !content ||
    (status !== 'draft' && status !== 'published' && status !== 'archived')
  ) {
    return null;
  }

  return {
    id,
    name,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    content,
    color,
    tags: tags.filter((tag): tag is string => typeof tag === 'string'),
    applicableTo: applicableTo.filter(
      (value): value is IRuleBlueprint['applicableTo'][number] =>
        typeof value === 'string',
    ),
    status,
    version,
    createdAt:
      typeof data.createdAt === 'string'
        ? data.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof data.updatedAt === 'string'
        ? data.updatedAt
        : new Date().toISOString(),
    createdBy:
      typeof data.createdBy === 'string' ? data.createdBy : undefined,
    updatedBy:
      typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    publishedAt:
      typeof data.publishedAt === 'string' ? data.publishedAt : undefined,
    publishedBy:
      typeof data.publishedBy === 'string' ? data.publishedBy : undefined,
    sourceUserId:
      typeof data.sourceUserId === 'string' ? data.sourceUserId : undefined,
    sourceRuleId:
      typeof data.sourceRuleId === 'string' ? data.sourceRuleId : undefined,
  };
}

function toSummary(blueprint: IRuleBlueprint): IRuleBlueprintSummary {
  return {
    id: blueprint.id,
    name: blueprint.name,
    description: blueprint.description,
    color: blueprint.color,
    tags: blueprint.tags,
    applicableTo: blueprint.applicableTo,
    status: blueprint.status,
    version: blueprint.version,
    updatedAt: blueprint.updatedAt,
  };
}

function normalizeSearchQuery(query?: string): string {
  return typeof query === 'string' ? query.trim().toLowerCase() : '';
}

function scoreBlueprintMatch(
  blueprint: IRuleBlueprint,
  query: string,
  tags?: string[],
): number {
  let score = 0;
  if (query) {
    const haystack = [
      blueprint.name,
      blueprint.description ?? '',
      blueprint.content.slice(0, 500),
      blueprint.tags.join(' '),
    ]
      .join('\n')
      .toLowerCase();
    if (haystack.includes(query)) {
      score += 10;
    }
    for (const token of query.split(/\s+/).filter(Boolean)) {
      if (haystack.includes(token)) {
        score += 2;
      }
    }
  }
  if (tags?.length) {
    for (const tag of tags) {
      if (blueprint.tags.includes(tag)) {
        score += 5;
      }
    }
  }
  return score;
}

export async function getRuleBlueprint(
  blueprintId: string,
): Promise<IRuleBlueprint | null> {
  const doc = await FirestorePaths.platformRuleBlueprint(blueprintId).get();
  if (!doc.exists) {
    return null;
  }
  return parseBlueprint(doc.id, doc.data() ?? {});
}

export async function listPublishedRuleBlueprints(): Promise<IRuleBlueprint[]> {
  const snapshot = await FirestorePaths.platformRuleBlueprints()
    .where('status', '==', PUBLISHED_STATUS)
    .orderBy('updatedAt', 'desc')
    .get();

  const blueprints: IRuleBlueprint[] = [];
  for (const doc of snapshot.docs) {
    const parsed = parseBlueprint(doc.id, doc.data());
    if (parsed) {
      blueprints.push(parsed);
    }
  }
  return blueprints;
}

export async function searchRuleBlueprints(
  input: ISearchRuleBlueprintsRequest,
): Promise<IRuleBlueprintSummary[]> {
  const limit = Math.min(
    Math.max(input.limit ?? DEFAULT_SEARCH_LIMIT, 1),
    MAX_SEARCH_LIMIT,
  );
  const query = normalizeSearchQuery(input.query);

  let blueprints = await listPublishedRuleBlueprints();

  if (input.applicableTo) {
    blueprints = blueprints.filter((blueprint) =>
      blueprint.applicableTo.includes(input.applicableTo!),
    );
  }

  const scored = blueprints
    .map((blueprint) => ({
      blueprint,
      score: scoreBlueprintMatch(blueprint, query, input.tags),
    }))
    .filter((entry) => (query || input.tags?.length ? entry.score > 0 : true))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.blueprint.updatedAt.localeCompare(left.blueprint.updatedAt);
    })
    .slice(0, limit)
    .map((entry) => toSummary(entry.blueprint));

  if (!query && !input.tags?.length) {
    return blueprints.slice(0, limit).map(toSummary);
  }

  return scored;
}

export async function createRuleFromBlueprint(
  userId: string,
  request: ICreateRuleFromBlueprintRequest,
): Promise<Rule> {
  const blueprint = await getRuleBlueprint(request.blueprintId);
  if (!blueprint || blueprint.status !== PUBLISHED_STATUS) {
    throw new Error('Rule blueprint not found or not published.');
  }

  const name = request.name.trim();
  const content = request.content.trim();
  if (!name || !content) {
    throw new Error('name and content are required');
  }
  if (content.length > 100_000) {
    throw new Error('Rule content cannot exceed 100,000 characters');
  }

  const applicableTo =
    request.applicableTo && request.applicableTo.length > 0
      ? request.applicableTo
      : blueprint.applicableTo;
  if (applicableTo.length === 0) {
    throw new Error('Rule must be applicable to at least one operation type');
  }

  const rule = await createRule(userId, {
    name,
    content,
    description: request.description ?? blueprint.description ?? '',
    color: request.color ?? blueprint.color,
    tags: request.tags ?? blueprint.tags,
    applicableTo,
    isDefault: request.isDefault ?? false,
    sourceBlueprintId: blueprint.id,
    sourceBlueprintVersion: blueprint.version,
    sourceBlueprintName: blueprint.name,
  });

  if (request.directoryId) {
    await attachRuleToDirectory(userId, rule.id, request.directoryId);
    const attached = await FirestorePaths.rule(userId, rule.id).get();
    if (attached.exists) {
      const data = attached.data();
      return {
        ...data,
        createdAt: data?.createdAt?.toDate() || new Date(),
        updatedAt: data?.updatedAt?.toDate() || new Date(),
      } as Rule;
    }
  }

  return rule;
}

import type {
  Directory,
  DirectoryTreeNode,
  GetDirectoryTreeResponse,
  Rule,
  RuleApplicability,
} from '@shared-types';
import { fetchDirectoryFromFirestore } from './directoryFirestore';
import { fetchDirectoryTreeFromFirestore } from './directoryTreeIndex';
import { fetchRulesFromFirestore } from './rulesFirestore';

interface IDirectoryHierarchy {
  directory: Directory;
  ancestors: Directory[];
}

function flattenDirectoriesFromTree(nodes: DirectoryTreeNode[]): Map<string, Directory> {
  const map = new Map<string, Directory>();

  function walk(treeNodes: DirectoryTreeNode[]) {
    for (const node of treeNodes) {
      map.set(node.directory.id, node.directory);
      walk(node.children);
    }
  }

  walk(nodes);
  return map;
}

function getDirectoryHierarchyFromTree(
  tree: GetDirectoryTreeResponse,
  directoryId: string,
): IDirectoryHierarchy | null {
  const directoryMap = flattenDirectoriesFromTree(tree.tree);
  const directory = directoryMap.get(directoryId);
  if (!directory) {
    return null;
  }

  const ancestors: Directory[] = [];
  let currentId = directory.parentId;

  while (currentId) {
    const parent = directoryMap.get(currentId);
    if (!parent) {
      return null;
    }
    ancestors.unshift(parent);
    currentId = parent.parentId;
  }

  return { directory, ancestors };
}

function sortRulesByHierarchy(
  rules: Rule[],
  directories: Directory[],
  ruleIdsByDirectory: Record<string, string[]>,
): Rule[] {
  const ruleToDirectoryLevel = new Map<string, number>();

  directories.forEach((dir, level) => {
    const ruleIds = ruleIdsByDirectory[dir.id] ?? [];
    ruleIds.forEach((ruleId) => {
      if (!ruleToDirectoryLevel.has(ruleId)) {
        ruleToDirectoryLevel.set(ruleId, level);
      }
    });
  });

  return [...rules].sort((a, b) => {
    const levelA = ruleToDirectoryLevel.get(a.id) ?? Number.POSITIVE_INFINITY;
    const levelB = ruleToDirectoryLevel.get(b.id) ?? Number.POSITIVE_INFINITY;

    if (levelA !== levelB) {
      return levelA - levelB;
    }

    return a.name.localeCompare(b.name);
  });
}

function resolveRulesFromHierarchy(
  hierarchy: IDirectoryHierarchy,
  ruleById: Map<string, Rule>,
  operation?: RuleApplicability,
): { rules: Rule[]; inheritanceMap: Record<string, Rule[]> } {
  const allDirectories = [...hierarchy.ancestors, hierarchy.directory];
  const ruleIdsByDirectory: Record<string, string[]> = {};
  const allRuleIds = new Set<string>();

  for (const dir of allDirectories) {
    const ruleIds = dir.ruleIds ?? [];
    ruleIdsByDirectory[dir.id] = ruleIds;
    ruleIds.forEach((id) => allRuleIds.add(id));
  }

  const allRules = Array.from(allRuleIds)
    .map((id) => ruleById.get(id))
    .filter((rule): rule is Rule => Boolean(rule));

  const filteredRules = operation
    ? allRules.filter((rule) => rule.applicableTo.includes(operation))
    : allRules;

  const inheritanceMap: Record<string, Rule[]> = {};
  for (const dir of allDirectories) {
    const dirRuleIds = ruleIdsByDirectory[dir.id] ?? [];
    inheritanceMap[dir.id] = filteredRules.filter((rule) => dirRuleIds.includes(rule.id));
  }

  return {
    rules: sortRulesByHierarchy(filteredRules, allDirectories, ruleIdsByDirectory),
    inheritanceMap,
  };
}

export interface IResolveDirectoryRulesOptions {
  includeAncestors?: boolean;
  operation?: RuleApplicability;
}

export async function resolveDirectoryRulesClient(
  userId: string,
  directoryId: string,
  options: IResolveDirectoryRulesOptions = {},
): Promise<{ rules: Rule[]; inheritanceMap: Record<string, Rule[]> }> {
  const includeAncestors = options.includeAncestors !== false;
  const operation = options.operation;

  const [tree, allRules] = await Promise.all([
    fetchDirectoryTreeFromFirestore(userId),
    fetchRulesFromFirestore(userId),
  ]);
  const ruleById = new Map(allRules.map((rule) => [rule.id, rule]));

  if (!includeAncestors) {
    const directory =
      flattenDirectoriesFromTree(tree.tree).get(directoryId) ??
      (await fetchDirectoryFromFirestore(userId, directoryId));

    if (!directory) {
      throw new Error('Directory not found');
    }

    const ruleIds = directory.ruleIds ?? [];
    const rules = ruleIds
      .map((id) => ruleById.get(id))
      .filter((rule): rule is Rule => Boolean(rule))
      .filter((rule) => !operation || rule.applicableTo.includes(operation));

    return {
      rules,
      inheritanceMap: {
        [directoryId]: rules,
      },
    };
  }

  const hierarchy = getDirectoryHierarchyFromTree(tree, directoryId);
  if (!hierarchy) {
    throw new Error('Directory not found');
  }

  return resolveRulesFromHierarchy(hierarchy, ruleById, operation);
}

export async function resolveApplicableRulesClient(
  userId: string,
  directoryId: string,
  operation: RuleApplicability,
): Promise<{ rules: Rule[]; defaultRuleIds: string[] }> {
  const { rules } = await resolveDirectoryRulesClient(userId, directoryId, {
    includeAncestors: true,
    operation,
  });

  return {
    rules,
    defaultRuleIds: rules.filter((rule) => rule.isDefault).map((rule) => rule.id),
  };
}

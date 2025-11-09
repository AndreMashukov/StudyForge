import { getFirestore } from 'firebase-admin/firestore';
import {
  Rule,
  RuleApplicability,
  Directory,
} from '@shared-types';
import { getRulesByIds } from './rule-crud';

const db = getFirestore();

/**
 * Rule Resolution Service
 * Handles cascading rule inheritance and rule formatting for AI injection
 */

interface DirectoryHierarchy {
  directory: Directory;
  ancestors: Directory[];
}

/**
 * Get directory and all its ancestors (for cascading)
 */
export async function getDirectoryHierarchy(
  userId: string,
  directoryId: string
): Promise<DirectoryHierarchy> {
  const directory = await getDirectory(userId, directoryId);
  
  if (!directory) {
    throw new Error('Directory not found');
  }

  const ancestors: Directory[] = [];
  let currentDirectory = directory;

  // Walk up the tree to get all ancestors
  while (currentDirectory.parentId) {
    const parent = await getDirectory(userId, currentDirectory.parentId);
    if (!parent) break;
    
    ancestors.push(parent);
    currentDirectory = parent;
  }

  // Reverse so root is first
  ancestors.reverse();

  return {
    directory,
    ancestors,
  };
}

/**
 * Get a single directory
 */
async function getDirectory(
  userId: string,
  directoryId: string
): Promise<Directory | null> {
  const dirDoc = await db
    .collection('directories')
    .doc(directoryId)
    .get();

  if (!dirDoc.exists) {
    return null;
  }

  const data = dirDoc.data();
  
  // Verify ownership
  if (data?.userId !== userId) {
    return null;
  }

  return {
    id: dirDoc.id,
    ...data,
    createdAt: data?.createdAt?.toDate() || new Date(),
    updatedAt: data?.updatedAt?.toDate() || new Date(),
  } as Directory;
}

/**
 * Get all rules for a directory (including cascading from ancestors)
 * Filters by operation type if provided
 */
export async function resolveRulesForDirectory(
  userId: string,
  directoryId: string,
  operation?: RuleApplicability
): Promise<{ rules: Rule[]; inheritanceMap: { [directoryId: string]: Rule[] } }> {
  const hierarchy = await getDirectoryHierarchy(userId, directoryId);
  
  // Collect all rule IDs from current directory and ancestors
  const allDirectories = [...hierarchy.ancestors, hierarchy.directory];
  const ruleIdsByDirectory: { [directoryId: string]: string[] } = {};
  const allRuleIds = new Set<string>();

  for (const dir of allDirectories) {
    const ruleIds = dir.ruleIds || [];
    ruleIdsByDirectory[dir.id] = ruleIds;
    ruleIds.forEach(id => allRuleIds.add(id));
  }

  // Fetch all rules
  const allRules = await getRulesByIds(userId, Array.from(allRuleIds));

  // Filter by operation type if provided
  const filteredRules = operation
    ? allRules.filter(rule => rule.applicableTo.includes(operation))
    : allRules;

  // Create inheritance map
  const inheritanceMap: { [directoryId: string]: Rule[] } = {};
  
  for (const dir of allDirectories) {
    const dirRuleIds = ruleIdsByDirectory[dir.id];
    inheritanceMap[dir.id] = filteredRules.filter(rule => 
      dirRuleIds.includes(rule.id)
    );
  }

  // Sort rules by directory hierarchy (parent first)
  const sortedRules = sortRulesByHierarchy(
    filteredRules,
    allDirectories,
    ruleIdsByDirectory
  );

  return {
    rules: sortedRules,
    inheritanceMap,
  };
}

/**
 * Sort rules by directory hierarchy (parent directories first)
 */
function sortRulesByHierarchy(
  rules: Rule[],
  directories: Directory[],
  ruleIdsByDirectory: { [directoryId: string]: string[] }
): Rule[] {
  const ruleToDirectoryLevel = new Map<string, number>();

  // Assign level to each rule based on directory hierarchy
  directories.forEach((dir, level) => {
    const ruleIds = ruleIdsByDirectory[dir.id] || [];
    ruleIds.forEach(ruleId => {
      // Use the earliest (highest in hierarchy) level for this rule
      if (!ruleToDirectoryLevel.has(ruleId)) {
        ruleToDirectoryLevel.set(ruleId, level);
      }
    });
  });

  // Sort rules by level, then by name
  return [...rules].sort((a, b) => {
    const levelA = ruleToDirectoryLevel.get(a.id) ?? Infinity;
    const levelB = ruleToDirectoryLevel.get(b.id) ?? Infinity;
    
    if (levelA !== levelB) {
      return levelA - levelB;
    }
    
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get applicable rules for a specific operation in a directory
 * Returns rules with defaults pre-selected
 */
export async function getApplicableRules(
  userId: string,
  directoryId: string,
  operation: RuleApplicability
): Promise<{ rules: Rule[]; defaultRuleIds: string[] }> {
  const { rules } = await resolveRulesForDirectory(userId, directoryId, operation);
  
  const defaultRuleIds = rules
    .filter(rule => rule.isDefault)
    .map(rule => rule.id);

  return {
    rules,
    defaultRuleIds,
  };
}

/**
 * Format selected rules for injection into AI prompt
 * Rules are numbered hierarchically
 */
export async function formatRulesForPrompt(
  userId: string,
  ruleIds: string[]
): Promise<string> {
  if (ruleIds.length === 0) {
    return '';
  }

  const rules = await getRulesByIds(userId, ruleIds);

  if (rules.length === 0) {
    return '';
  }

  // Get directory names for each rule
  const directoryNames = await getDirectoryNamesForRules(userId, rules);

  // Build rule blocks
  const ruleBlocks = rules.map((rule, index) => {
    const dirName = directoryNames.get(rule.id) || 'Unknown Directory';
    const separator = '─'.repeat(61);
    
    return `${separator}
RULE #${index + 1} (From: ${dirName}) - ${rule.name}
${separator}
${rule.content}`;
  });

  const separator = '─'.repeat(61);
  
  return `
${separator}
ADDITIONAL RULES TO FOLLOW:

The user has selected the following rules to guide your response. 
These rules are listed in hierarchical order (parent directories first). 
Please consider all rules intelligently, prioritizing based on context.

${ruleBlocks.join('\n\n')}

${separator}
END OF RULES

Please generate content that follows these rules while maintaining
coherence and quality.
`;
}

/**
 * Get directory names for rules (uses first directory in directoryIds array)
 */
async function getDirectoryNamesForRules(
  userId: string,
  rules: Rule[]
): Promise<Map<string, string>> {
  const directoryNames = new Map<string, string>();
  const directoryIds = new Set<string>();

  // Collect unique directory IDs
  rules.forEach(rule => {
    if (rule.directoryIds.length > 0) {
      directoryIds.add(rule.directoryIds[0]);
    }
  });

  // Fetch directories
  const directories = await Promise.all(
    Array.from(directoryIds).map(dirId => getDirectory(userId, dirId))
  );

  // Map directory IDs to names
  const dirIdToName = new Map<string, string>();
  directories.forEach(dir => {
    if (dir) {
      dirIdToName.set(dir.id, dir.path || dir.name);
    }
  });

  // Map rule IDs to directory names
  rules.forEach(rule => {
    if (rule.directoryIds.length > 0) {
      const dirId = rule.directoryIds[0];
      const dirName = dirIdToName.get(dirId);
      if (dirName) {
        directoryNames.set(rule.id, dirName);
      }
    }
  });

  return directoryNames;
}

/**
 * Get rules attached to a specific directory (not cascading)
 */
export async function getDirectoryRules(
  userId: string,
  directoryId: string
): Promise<Rule[]> {
  const directory = await getDirectory(userId, directoryId);
  
  if (!directory) {
    throw new Error('Directory not found');
  }

  if (!directory.ruleIds || directory.ruleIds.length === 0) {
    return [];
  }

  return getRulesByIds(userId, directory.ruleIds);
}

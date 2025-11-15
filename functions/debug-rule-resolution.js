/**
 * Debug script to test rule resolution logic
 * Run with: node debug-rule-resolution.js
 */

// Simulated directory structure
const directories = {
  'root': {
    id: 'root',
    name: 'Root',
    path: '/',
    parentId: null,
    ruleIds: ['rule-root-1'], // Rules attached to root
  },
  'computer-science': {
    id: 'computer-science',
    name: 'Computer Science',
    path: '/Computer Science',
    parentId: 'root',
    ruleIds: ['rule-cs-1'], // Rules attached to Computer Science
  },
  'dsa': {
    id: 'dsa',
    name: 'DSA',
    path: '/Computer Science/DSA',
    parentId: 'computer-science',
    ruleIds: ['rule-dsa-1', 'rule-dsa-2'], // Programming rules
  },
  'chinese': {
    id: 'chinese',
    name: 'Chinese Lang',
    path: '/Chinese Lang',
    parentId: 'root',
    ruleIds: ['rule-chinese-1', 'rule-chinese-2'], // Language rules
  },
};

const rules = {
  'rule-root-1': { id: 'rule-root-1', name: 'Root Rule', directoryIds: ['root'] },
  'rule-cs-1': { id: 'rule-cs-1', name: 'CS Rule', directoryIds: ['computer-science'] },
  'rule-dsa-1': { id: 'rule-dsa-1', name: 'DSA Code Rule', directoryIds: ['dsa'] },
  'rule-dsa-2': { id: 'rule-dsa-2', name: 'DSA Diagram Rule', directoryIds: ['dsa'] },
  'rule-chinese-1': { id: 'rule-chinese-1', name: 'Chinese Learning Rule', directoryIds: ['chinese'] },
  'rule-chinese-2': { id: 'rule-chinese-2', name: 'Chinese Format Rule', directoryIds: ['chinese'] },
};

/**
 * Simulate getDirectoryHierarchy function
 */
function getDirectoryHierarchy(directoryId) {
  const directory = directories[directoryId];
  if (!directory) {
    throw new Error(`Directory ${directoryId} not found`);
  }

  const ancestors = [];
  let currentId = directory.parentId;

  while (currentId) {
    const parent = directories[currentId];
    if (!parent) break;
    
    ancestors.push(parent);
    currentId = parent.parentId;
  }

  // Reverse so root is first
  ancestors.reverse();

  return {
    directory,
    ancestors,
  };
}

/**
 * Simulate resolveRulesForDirectory function
 */
function resolveRulesForDirectory(directoryId) {
  console.log('\n=== RULE RESOLUTION DEBUG ===');
  console.log(`Resolving rules for directory: ${directoryId}`);
  
  const hierarchy = getDirectoryHierarchy(directoryId);
  
  console.log('\nTarget directory:', {
    id: hierarchy.directory.id,
    name: hierarchy.directory.name,
    path: hierarchy.directory.path,
    ruleIds: hierarchy.directory.ruleIds || [],
  });
  
  console.log('\nAncestors:', hierarchy.ancestors.map(d => ({
    id: d.id,
    name: d.name,
    path: d.path,
    ruleIds: d.ruleIds || [],
  })));

  const allDirectories = [...hierarchy.ancestors, hierarchy.directory];
  const allRuleIds = new Set();

  for (const dir of allDirectories) {
    const ruleIds = dir.ruleIds || [];
    ruleIds.forEach(id => allRuleIds.add(id));
    
    console.log(`\nCollecting ${ruleIds.length} rule IDs from directory: ${dir.name} (${dir.id}):`, ruleIds);
  }

  console.log('\nTotal unique rule IDs collected:', Array.from(allRuleIds));

  // Fetch rules
  const resolvedRules = Array.from(allRuleIds).map(id => rules[id]);
  
  console.log('\nResolved rules:');
  resolvedRules.forEach(r => {
    console.log(`  - ${r.name} (${r.id}) attached to directories: ${r.directoryIds.join(', ')}`);
  });

  console.log('\n=== END DEBUG ===\n');

  return resolvedRules;
}

// Test Case 1: Resolve rules for DSA directory (should get DSA + CS + Root rules)
console.log('\n\n========================================');
console.log('TEST CASE 1: DSA Directory');
console.log('========================================');
console.log('Expected: rule-dsa-1, rule-dsa-2, rule-cs-1, rule-root-1');
const dsaRules = resolveRulesForDirectory('dsa');
console.log('Result:', dsaRules.map(r => r.id).join(', '));

// Test Case 2: Resolve rules for Chinese directory (should get Chinese + Root rules ONLY)
console.log('\n\n========================================');
console.log('TEST CASE 2: Chinese Lang Directory');
console.log('========================================');
console.log('Expected: rule-chinese-1, rule-chinese-2, rule-root-1');
const chineseRules = resolveRulesForDirectory('chinese');
console.log('Result:', chineseRules.map(r => r.id).join(', '));

// Verification
console.log('\n\n========================================');
console.log('VERIFICATION');
console.log('========================================');

const chineseRuleIds = chineseRules.map(r => r.id);
const hasDSARules = chineseRuleIds.some(id => id.includes('dsa'));
const hasCSRules = chineseRuleIds.some(id => id.includes('cs'));

if (hasDSARules || hasCSRules) {
  console.log('❌ BUG DETECTED: Chinese directory has DSA or CS rules!');
  console.log('   DSA rules found:', chineseRuleIds.filter(id => id.includes('dsa')));
  console.log('   CS rules found:', chineseRuleIds.filter(id => id.includes('cs')));
} else {
  console.log('✅ CORRECT: Chinese directory only has Chinese and Root rules');
}

console.log('\n');

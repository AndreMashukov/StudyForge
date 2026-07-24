#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!entry.includes('node_modules')) walk(full, acc);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const replacements = [
  // generation-rate-limit moved to generation lib
  [
    /@study-forge\/backend-core\/lib\/generation-rate-limit/g,
    '@study-forge/backend-generation/generation-rate-limit',
  ],
  [
    /from ['"]@study-forge\/backend-core\/interaction-tracking['"]/g,
    "from '@study-forge/backend-core/services/interaction-tracking'",
  ],
  [
    /from ['"]@study-forge\/backend-core\/learning-telemetry['"]/g,
    "from '@study-forge/backend-core/services/learning-telemetry'",
  ],
  [
    /from ['"]@study-forge\/backend-core\/statistics['"]/g,
    "from '@study-forge/backend-core/services/statistics'",
  ],
  // core services cross refs
  [
    /from ['"]\.\/generation-rate-limit-profiles['"]/g,
    "from '@study-forge/backend-generation/generation-rate-limit-profiles'",
  ],
  [
    /from ['"]\.\/generation-rate-limit-logic['"]/g,
    "from '@study-forge/backend-generation/generation-rate-limit-logic'",
  ],
  // documents cross-lib
  [
    /from ['"]\.\/llm['"]/g,
    "from '@study-forge/backend-llm/llm'",
  ],
  [
    /from ['"]\.\/promptBuilder['"]/g,
    "from '@study-forge/backend-llm/promptBuilder'",
  ],
  [
    /from ['"]\.\/directory['"]/g,
    "from '@study-forge/backend-directories/directory'",
  ],
  [
    /from ['"]\.\/directory-item-index['"]/g,
    "from '@study-forge/backend-directories/directory-item-index'",
  ],
  [
    /from ['"]\.\/document-crud['"]/g,
    "from '@study-forge/backend-documents/document-crud'",
  ],
  [
    /from ['"]\.\/document-storage['"]/g,
    "from '@study-forge/backend-documents/document-storage'",
  ],
  [
    /from ['"]\.\/document-storage\.js['"]/g,
    "from '@study-forge/backend-documents/document-storage'",
  ],
  // generation cross-lib
  [
    /from ['"]\.\/generation-jobs['"]/g,
    "from '@study-forge/backend-generation/generation-jobs'",
  ],
  [
    /from ['"]\.\/generation-job-payload-storage['"]/g,
    "from '@study-forge/backend-generation/generation-job-payload-storage'",
  ],
  [
    /from ['"]\.\/generation-task-queue['"]/g,
    "from '@study-forge/backend-generation/generation-task-queue'",
  ],
  [
    /from ['"]\.\/artifact-generation-records['"]/g,
    "from '@study-forge/backend-artifacts/artifact-generation-records'",
  ],
  [
    /from ['"]\.\/api-rate-limit['"]/g,
    "from '@study-forge/backend-core/services/api-rate-limit'",
  ],
  [
    /from ['"]\.\/artifact-agent\/([^'"]+)['"]/g,
    "from '@study-forge/backend-artifacts/artifact-agent/$1'",
  ],
  [
    /from ['"]\.\.\/gemini\/prompt-builder\/([^'"]+)['"]/g,
    "from '@study-forge/backend-llm/gemini/prompt-builder/$1'",
  ],
  // directories cross-lib
  [
    /from ['"]\.\/interaction-tracking['"]/g,
    "from '@study-forge/backend-core/services/interaction-tracking'",
  ],
  // functions dynamic imports
  [
    /import\(['"]\.\.\/services\/bulk-operation\.js['"]\)/g,
    "import('@study-forge/backend-artifacts/bulk-operation')",
  ],
  [
    /import\(['"]\.\.\/services\/bulk-operation\.js['"]\)/g,
    "import('@study-forge/backend-artifacts/bulk-operation')",
  ],
  [
    /import\(['"]\.\.\/services\/gemini\/prompt-builder\/([^'"]+)['"]\)/g,
    "import('@study-forge/backend-llm/gemini/prompt-builder/$1')",
  ],
  [
    /from ['"]\.\.\/services\/bulk-operation\.js['"]/g,
    "from '@study-forge/backend-artifacts/bulk-operation'",
  ],
];

function rewrite(content) {
  let next = content;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

const dirs = [
  join(ROOT, 'libs/backend'),
  join(ROOT, 'functions/src'),
];

let changed = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    const original = readFileSync(file, 'utf8');
    const updated = rewrite(original);
    if (updated !== original) {
      writeFileSync(file, updated);
      changed++;
      console.log(relative(ROOT, file));
    }
  }
}
console.log(`Updated ${changed} files`);

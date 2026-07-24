#!/usr/bin/env node
/**
 * Rewrites functions + backend lib imports after services extraction.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

const CORE_IMPORTS = [
  'firestore-paths',
  'firestore-ttl',
  'cursor-pagination',
  'auth',
  'callable-error',
  'api-key-auth',
  'app-check-verification',
  'start-generation-response',
  'ai-revision-validation',
  'generation-rate-limit',
];

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

function rewrite(content, filePath) {
  let next = content;

  // shared-types deep imports
  next = next.replace(
    /from ['"]\.\.\/\.\.\/libs\/shared-types\/src\/index['"]/g,
    "from '@shared-types'"
  );

  // lib/* -> backend-core
  for (const mod of CORE_IMPORTS) {
    next = next.replace(
      new RegExp(`from ['"]\\.\\./lib/${mod}['"]`, 'g'),
      `from '@study-forge/backend-core/lib/${mod}'`
    );
    next = next.replace(
      new RegExp(`from ['"]\\.\\./\\.\\./lib/${mod}['"]`, 'g'),
      `from '@study-forge/backend-core/lib/${mod}'`
    );
  }

  // core services
  next = next.replace(
    /from ['"]\.\.\/services\/api-rate-limit['"]/g,
    "from '@study-forge/backend-core/services/api-rate-limit'"
  );

  // Cross-lib service imports (old flat services/ layout)
  const crossLib = [
    ['gemini', 'backend-llm'],
    ['llm', 'backend-llm'],
    ['document-crud', 'backend-documents'],
    ['document-storage', 'backend-documents'],
    ['scraper', 'backend-documents'],
    ['rule-resolution', 'backend-directories'],
    ['rule-crud', 'backend-directories'],
    ['directory', 'backend-directories'],
    ['directory-item-index', 'backend-directories'],
    ['firestore', 'backend-artifacts'],
    ['artifact-generation-records', 'backend-artifacts'],
    ['artifact-delete', 'backend-artifacts'],
    ['bulk-operation', 'backend-artifacts'],
    ['generation-jobs', 'backend-generation'],
    ['generation-enqueue', 'backend-generation'],
    ['generation-job-failures', 'backend-generation'],
    ['generation-job-payload-storage', 'backend-generation'],
    ['generation-job-retry', 'backend-generation'],
    ['generation-stale', 'backend-generation'],
    ['generation-task-queue', 'backend-generation'],
    ['stale-generation-sweeper', 'backend-generation'],
    ['generation-rate-limit-logic', 'backend-generation'],
    ['interaction-tracking', 'backend-core'],
    ['learning-telemetry', 'backend-core'],
    ['statistics', 'backend-core'],
  ];

  for (const [mod, lib] of crossLib) {
    next = next.replace(
      new RegExp(`from ['"]\\.\\./${mod}['"]`, 'g'),
      `from '@study-forge/${lib}/${mod}'`
    );
    next = next.replace(
      new RegExp(`from ['"]\\.\\./\\.\\./${mod}['"]`, 'g'),
      `from '@study-forge/${lib}/${mod}'`
    );
  }

  // Subpath imports for gemini/llm/artifact-agent from other libs
  next = next.replace(
    /from ['"]\.\.\/gemini\/([^'"]+)['"]/g,
    "from '@study-forge/backend-llm/gemini/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/llm\/([^'"]+)['"]/g,
    "from '@study-forge/backend-llm/llm/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/artifact-agent\/([^'"]+)['"]/g,
    "from '@study-forge/backend-artifacts/artifact-agent/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/mermaid\/([^'"]+)['"]/g,
    "from '@study-forge/backend-artifacts/mermaid/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/mermaid['"]/g,
    "from '@study-forge/backend-artifacts/mermaid'"
  );
  next = next.replace(
    /from ['"]\.\.\/diagram-quiz\/([^'"]+)['"]/g,
    "from '@study-forge/backend-artifacts/diagram-quiz/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/flashcards\/([^'"]+)['"]/g,
    "from '@study-forge/backend-artifacts/flashcards/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/generation-processors\/([^'"]+)['"]/g,
    "from '@study-forge/backend-generation/generation-processors/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/file-extraction\/([^'"]+)['"]/g,
    "from '@study-forge/backend-documents/file-extraction/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/url-processing\/([^'"]+)['"]/g,
    "from '@study-forge/backend-documents/url-processing/$1'"
  );
  next = next.replace(
    /from ['"]\.\.\/screenshot-document-agent\/([^'"]+)['"]/g,
    "from '@study-forge/backend-documents/screenshot-document-agent/$1'"
  );

  // functions app: endpoints + tasks
  if (filePath.includes('/functions/src/')) {
    next = next.replace(
      /from ['"]\.\.\/lib\/([^'"]+)['"]/g,
      "from '@study-forge/backend-core/lib/$1'"
    );
    next = next.replace(
      /from ['"]\.\.\/services\/([^'"]+)['"]/g,
      (_match, subpath) => {
        const top = subpath.split('/')[0];
        const libMap = {
          gemini: 'backend-llm',
          llm: 'backend-llm',
          promptBuilder: 'backend-llm',
          'document-crud': 'backend-documents',
          'document-storage': 'backend-documents',
          scraper: 'backend-documents',
          'file-extraction': 'backend-documents',
          'url-processing': 'backend-documents',
          'source-document-generation': 'backend-documents',
          'screenshot-document-generation': 'backend-documents',
          'screenshot-document-agent': 'backend-documents',
          directory: 'backend-directories',
          'directory-chat': 'backend-directories',
          'directory-chat-context-assembler': 'backend-directories',
          'directory-chat-retrieval': 'backend-directories',
          'directory-item-index': 'backend-directories',
          'rule-crud': 'backend-directories',
          'rule-resolution': 'backend-directories',
          firestore: 'backend-artifacts',
          'artifact-delete': 'backend-artifacts',
          'artifact-generation-records': 'backend-artifacts',
          'artifact-agent': 'backend-artifacts',
          'bulk-operation': 'backend-artifacts',
          'diagram-quiz': 'backend-artifacts',
          flashcards: 'backend-artifacts',
          mermaid: 'backend-artifacts',
          'subject-world-normalizer': 'backend-artifacts',
          'generation-enqueue': 'backend-generation',
          'generation-jobs': 'backend-generation',
          'generation-job-failures': 'backend-generation',
          'generation-job-retry': 'backend-generation',
          'generation-stale': 'backend-generation',
          'generation-task-queue': 'backend-generation',
          'generation-processors': 'backend-generation',
          'stale-generation-sweeper': 'backend-generation',
          'interaction-tracking': 'backend-core',
          'learning-telemetry': 'backend-core',
          statistics: 'backend-core',
          'api-rate-limit': 'backend-core',
        };
        const lib = libMap[top];
        if (lib) return `from '@study-forge/${lib}/${subpath}'`;
        return _match;
      }
    );
  }

  return next;
}

const dirs = [
  join(ROOT, 'libs/backend'),
  join(ROOT, 'functions/src/endpoints'),
  join(ROOT, 'functions/src/tasks'),
  join(ROOT, 'functions/src/lib'),
];

let changed = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    const original = readFileSync(file, 'utf8');
    const updated = rewrite(original, file);
    if (updated !== original) {
      writeFileSync(file, updated);
      changed++;
      console.log(relative(ROOT, file));
    }
  }
}
console.log(`Updated ${changed} files`);

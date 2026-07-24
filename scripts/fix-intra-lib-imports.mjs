#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;

const libs = {
  core: 'libs/backend/core/src',
  llm: 'libs/backend/llm/src',
  generation: 'libs/backend/generation/src',
  documents: 'libs/backend/documents/src',
  directories: 'libs/backend/directories/src',
  artifacts: 'libs/backend/artifacts/src',
};

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

function toRelative(file, importPath, libSrcRoot) {
  const target = join(ROOT, libSrcRoot, importPath.replace(/\.js$/, ''));
  let rel = relative(dirname(file), target).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

let changed = 0;
for (const [name, libPath] of Object.entries(libs)) {
  const libRoot = join(ROOT, libPath);
  const aliasPrefix = `@study-forge/backend-${name}/`;
  for (const file of walk(libRoot)) {
    let content = readFileSync(file, 'utf8');
    const updated = content.replace(
      new RegExp(`from ['"]${aliasPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^'"]+)['"]`, 'g'),
      (_match, subpath) => {
        const rel = toRelative(file, subpath, libPath);
        return `from '${rel}'`;
      }
    );
    if (updated !== content) {
      writeFileSync(file, updated);
      changed++;
      console.log(relative(ROOT, file));
    }
  }
}
console.log(`Fixed ${changed} intra-lib imports`);

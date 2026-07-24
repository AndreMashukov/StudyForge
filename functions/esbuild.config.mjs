import * as esbuild from 'esbuild';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');

const externalPackages = [
  'firebase-admin',
  'firebase-functions',
  '@google/genai',
  '@google/adk',
  'cheerio',
  'dompurify',
  'fast-xml-parser',
  'firebase',
  'jsdom',
  'jszip',
  'mammoth',
  'mermaid',
  'node-fetch',
  'papaparse',
  'pdf-parse',
  'turndown',
  'zod',
];

async function build() {
  await esbuild.build({
    entryPoints: [resolve(workspaceRoot, 'functions/src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: resolve(workspaceRoot, 'functions/lib/src/index.js'),
    sourcemap: true,
    tsconfig: resolve(workspaceRoot, 'tsconfig.base.json'),
    external: externalPackages,
    logLevel: 'info',
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Release pipeline constants. See docs/adr/009-llm-proposed-release-plan.md.
 */

export const PROJECT_ID = process.env.RELEASE_FIREBASE_PROJECT || 'study-forge-202604';
export const REGION = 'asia-east1';
/** Numeric project id — pins the compute SA and Google service agents an LLM grant may name. */
export const PROJECT_NUMBER = process.env.RELEASE_PROJECT_NUMBER || '853327102927';

/** Together AI serves the Anthropic Messages API at {baseURL}/v1/messages. */
export const LLM_BASE_URL = process.env.RELEASE_LLM_BASE_URL || 'https://api.together.xyz';
export const LLM_MODEL = process.env.RELEASE_LLM_MODEL || 'MiniMaxAI/MiniMax-M3.1-Flash';
export const LLM_TIMEOUT_MS = 90_000;
/** One initial attempt plus two retries (network failure, unparseable reply or invalid plan). */
export const LLM_MAX_ATTEMPTS = 3;
/** MiniMax reasons before answering; a large diff can spend 8k tokens on thinking alone. */
export const LLM_MAX_TOKENS = 16_000;
/** Extra warnings are dropped, not rejected — they're informational and shouldn't fail a release. */
export const LLM_MAX_WARNINGS = 5;

export const FUNCTIONS_ENTRY = 'functions/src/index.ts';
export const FUNCTIONS_BUNDLE = 'functions/lib/src/index.js';
export const MIGRATIONS_DIR = 'scripts/migrations';

/** Firestore collections (Admin SDK only; no client rule matches them, so clients are denied). */
export const LEDGER_COLLECTION = '_releaseMigrations';
export const LEDGER_META_DOC = '_releaseMeta/migrationLedger';

/**
 * Any change here can alter every function in the single esbuild bundle,
 * so the import graph can't narrow it down: deploy all functions.
 */
export const FORCE_ALL_FUNCTION_PATHS = [
  'package.json',
  'yarn.lock',
  'tsconfig.base.json',
  'functions/package.json',
  'functions/yarn.lock',
  'functions/package-lock.json',
  'functions/tsconfig.json',
  'functions/esbuild.config.mjs',
  'functions/esbuild.externals.mjs',
];

export const RULES_FILES = {
  firestoreRules: 'firestore.rules',
  firestoreIndexes: 'firestore.indexes.json',
  storageRules: 'storage.rules',
} as const;

/** Lockfiles and build output are noise for the LLM; their effect is already captured deterministically. */
export const DIFF_EXCLUDE = [
  /(^|\/)yarn\.lock$/,
  /(^|\/)package-lock\.json$/,
  /^dist\//,
  /(^|\/)lib\//,
  /\.snap$/,
  /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf)$/i,
  /^\.DS_Store$|\/\.DS_Store$/,
  /^mobile-capture\/\.expo\//,
];
export const DIFF_MAX_CHARS_PER_FILE = 6_000;
export const DIFF_MAX_CHARS_TOTAL = 120_000;

/**
 * The only IAM grants the LLM may propose. Each role is tied to one resource type and
 * is a resource-level binding — the deploy identity never needs project IAM admin.
 */
export const LLM_IAM_ALLOWLIST = {
  'roles/run.invoker': 'function',
  'roles/cloudtasks.enqueuer': 'taskQueue',
  'roles/pubsub.publisher': 'pubsubTopic',
} as const;

export const LLM_IAM_ROLES = ['roles/run.invoker', 'roles/cloudtasks.enqueuer', 'roles/pubsub.publisher'] as const;
export type AllowlistedRole = (typeof LLM_IAM_ROLES)[number];
export type IamResourceType = (typeof LLM_IAM_ALLOWLIST)[AllowlistedRole];

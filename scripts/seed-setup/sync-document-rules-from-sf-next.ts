#!/usr/bin/env node
/**
 * Sync StudyForge document-generation rules with sf-next-supabase HTML/Plotly/math contracts.
 *
 * Updates:
 *   - Technical Document Output Standards → Doc HTML Format
 *   - Technical Documentation Generator → HTML version (no longer default)
 *   - Math Study Document Formatting → KaTeX-ready guidance
 *   - Creates Web Graph Rendering + Web Math Formula Rendering when missing
 *
 * Usage:
 *   # Emulator (default when FIRESTORE_EMULATOR_HOST is set or --emulator)
 *   npx tsx scripts/seed-setup/sync-document-rules-from-sf-next.ts --emulator
 *
 *   # Production (requires ADC / GOOGLE_APPLICATION_CREDENTIALS)
 *   npx tsx scripts/seed-setup/sync-document-rules-from-sf-next.ts --production
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import { config } from 'dotenv';
import {
  DOC_HTML_FORMAT_CONTENT,
  MATH_STUDY_DOCUMENT_FORMATTING_CONTENT,
  SEED_DOCUMENT_RULES,
  TECHNICAL_DOCUMENTATION_GENERATOR_HTML_CONTENT,
  WEB_GRAPH_RENDERING_CONTENT,
  WEB_MATH_FORMULA_RENDERING_CONTENT,
} from './seed-document-rules';

config({ path: path.join(process.cwd(), '.env.local') });

const PROJECT_ID =
  process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'study-forge-202604';
const PROD_USER_ID = 'DDdGUbQA7Ag3EBsdtSdbAF7ukRk1';
const EMU_USER_ID = '4ZBsEPIUJ4jrlylcXkg7t3sFdPZv';

const PROD_DOC_HTML_RULE_ID = 'iS4q3d7i9tAd6BusgErb'; // was Technical Document Output Standards
const PROD_TECH_DOC_GEN_RULE_ID = 'Qbuhe9HTfnOOzWDPuwMV';
const PROD_MATH_STUDY_RULE_ID = 'afCOypJnapeDHPGcGVd0';
const PROD_WEB_GRAPH_RULE_ID = 'sfHtmlWebGraphRendering';
const PROD_WEB_MATH_RULE_ID = 'sfHtmlWebMathFormulaRendering';

function parseArgs(): { mode: 'emulator' | 'production' } {
  if (process.argv.includes('--production')) {
    return { mode: 'production' };
  }
  return { mode: 'emulator' };
}

async function upsertRule(
  db: admin.firestore.Firestore,
  userId: string,
  ruleId: string,
  data: {
    name: string;
    description: string;
    content: string;
    applicableTo: string[];
    isDefault: boolean;
    tags: string[];
    color: string;
    directoryIds?: string[];
  }
): Promise<void> {
  const ref = db.doc(`users/${userId}/rules/${ruleId}`);
  const existing = await ref.get();
  const now = admin.firestore.Timestamp.now();
  const previous = existing.exists ? existing.data() : undefined;

  await ref.set(
    {
      id: ruleId,
      userId,
      name: data.name,
      description: data.description,
      content: data.content,
      color: data.color,
      tags: data.tags,
      applicableTo: data.applicableTo,
      isDefault: data.isDefault,
      directoryIds: data.directoryIds ?? previous?.directoryIds ?? [],
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    },
    { merge: true }
  );
  console.log(`   ✅ ${existing.exists ? 'Updated' : 'Created'}: ${data.name} (${ruleId})`);
}

async function syncEmulator(db: admin.firestore.Firestore): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  console.log(`\nSyncing emulator rules for ${EMU_USER_ID} …`);

  for (const rule of SEED_DOCUMENT_RULES) {
    await upsertRule(db, EMU_USER_ID, rule.id, {
      name: rule.name,
      description: rule.description,
      content: rule.content,
      applicableTo: rule.applicableTo,
      isDefault: rule.isDefault,
      tags: rule.tags,
      color: rule.color,
      directoryIds: ['e2estudymaterials'],
    });
  }

  await db.doc(`users/${EMU_USER_ID}/directories/e2estudymaterials`).set(
    {
      ruleIds: SEED_DOCUMENT_RULES.map((rule) => rule.id),
      updatedAt: now,
    },
    { merge: true }
  );
  await db.doc(`users/${EMU_USER_ID}/rules/e2e-prompt-rule`).delete().catch(() => undefined);
  console.log('   ✅ Study Materials directory ruleIds updated');
}

async function syncProduction(db: admin.firestore.Firestore): Promise<void> {
  console.log(`\nSyncing production rules for ${PROD_USER_ID} …`);

  await upsertRule(db, PROD_USER_ID, PROD_DOC_HTML_RULE_ID, {
    name: 'Doc HTML Format',
    description:
      'HTML-first document format: structure, tables, code samples, and Mermaid diagrams for StudyForge learning docs.',
    content: DOC_HTML_FORMAT_CONTENT,
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    tags: ['document', 'html', 'format', 'mermaid'],
    color: 'blue',
  });

  await upsertRule(db, PROD_USER_ID, PROD_TECH_DOC_GEN_RULE_ID, {
    name: 'Technical Documentation Generator',
    description:
      'HTML technical documentation structure (Glossary → Core Concepts → Examples → Summary). Prefer Doc HTML Format for purity constraints.',
    content: TECHNICAL_DOCUMENTATION_GENERATOR_HTML_CONTENT,
    applicableTo: ['prompt'],
    isDefault: false,
    tags: ['document', 'html', 'technical'],
    color: 'blue',
  });

  await upsertRule(db, PROD_USER_ID, PROD_MATH_STUDY_RULE_ID, {
    name: 'Math Study Document Formatting',
    description:
      'Structures math study materials with KaTeX-ready LaTeX, defined variables, and step-by-step examples.',
    content: MATH_STUDY_DOCUMENT_FORMATTING_CONTENT,
    applicableTo: ['prompt'],
    isDefault: false,
    tags: ['document', 'math', 'latex', 'katex'],
    color: 'purple',
  });

  await upsertRule(db, PROD_USER_ID, PROD_WEB_GRAPH_RULE_ID, {
    name: 'Web Graph Rendering',
    description:
      'Guidelines for embedding interactive 2D/3D Plotly graphs in HTML documents.',
    content: WEB_GRAPH_RENDERING_CONTENT,
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    tags: ['document', 'html', 'plotly', 'graphs'],
    color: 'indigo',
  });

  await upsertRule(db, PROD_USER_ID, PROD_WEB_MATH_RULE_ID, {
    name: 'Web Math Formula Rendering',
    description:
      'Guidelines for rendering mathematical formulas with LaTeX delimiters (KaTeX viewer).',
    content: WEB_MATH_FORMULA_RENDERING_CONTENT,
    applicableTo: ['prompt', 'upload', 'scraping'],
    isDefault: true,
    tags: ['document', 'html', 'math', 'latex', 'katex'],
    color: 'purple',
  });
}

async function main(): Promise<void> {
  const { mode } = parseArgs();

  if (mode === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  } else {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore();
  if (mode === 'emulator') {
    await syncEmulator(db);
  } else {
    await syncProduction(db);
  }

  console.log(`\n✅ Document rules sync complete (${mode}).`);
}

main().catch((error) => {
  console.error('❌ Sync failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Seeds platform rule blueprints from canonical user rules.
 *
 * Usage (from repo root, with Firebase credentials):
 *   npx tsx scripts/seed-setup/seed-rule-blueprints.ts
 *
 * Options:
 *   --dry-run   Print planned blueprints without writing
 *   --publish   Mark blueprints as published (default: draft)
 */

import admin from 'firebase-admin';
import type { IRuleBlueprint } from '../../libs/shared-types/src/rule-blueprints';
import {
  RuleApplicability,
  RuleColor,
} from '../../libs/shared-types/src/index';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'study-forge-202604';
const SOURCE_USER_ID = 'DDdGUbQA7Ag3EBsdtSdbAF7ukRk1';

interface IBlueprintSeedSpec {
  platformId: string;
  sourceRuleId: string;
  name?: string;
  description?: string;
  tags?: string[];
  applicableTo?: RuleApplicability[];
  color?: RuleColor;
}

const BLUEPRINT_SEEDS: IBlueprintSeedSpec[] = [
  {
    platformId: 'bp-doc-html-format',
    sourceRuleId: 'iS4q3d7i9tAd6BusgErb',
    name: 'Doc HTML Format',
    description:
      'HTML-first document format: structure, tables, code samples, and Mermaid diagrams.',
    tags: ['document', 'html', 'format', 'mermaid'],
    applicableTo: [
      RuleApplicability.PROMPT,
      RuleApplicability.UPLOAD,
      RuleApplicability.SCRAPING,
    ],
    color: RuleColor.BLUE,
  },
  {
    platformId: 'bp-web-math-formulas',
    sourceRuleId: 'sfHtmlWebMathFormulaRendering',
    name: 'Web Math Formula Rendering',
    description:
      'Opt-in math formulas with LaTeX delimiters for the KaTeX viewer.',
    tags: ['document', 'html', 'math', 'latex', 'katex'],
    applicableTo: [
      RuleApplicability.PROMPT,
      RuleApplicability.UPLOAD,
      RuleApplicability.SCRAPING,
    ],
    color: RuleColor.PURPLE,
  },
  {
    platformId: 'bp-web-graph-rendering',
    sourceRuleId: 'sfHtmlWebGraphRendering',
    name: 'Web Graph Rendering',
    description: 'Embed interactive 2D/3D Plotly graphs in HTML documents.',
    tags: ['document', 'html', 'plotly', 'graphs'],
    applicableTo: [
      RuleApplicability.PROMPT,
      RuleApplicability.UPLOAD,
      RuleApplicability.SCRAPING,
    ],
    color: RuleColor.INDIGO,
  },
  {
    platformId: 'bp-mermaid-diagram-standards',
    sourceRuleId: '0VsALrGmkxKkMVpzpeyc',
    name: 'Mermaid Diagram Standards',
    description:
      'Standards for clear, accessible Mermaid diagrams in documents and follow-ups.',
    tags: ['mermaid', 'diagram', 'document'],
    applicableTo: [RuleApplicability.PROMPT, RuleApplicability.FOLLOWUP],
    color: RuleColor.GREEN,
  },
  {
    platformId: 'bp-quiz-generic',
    sourceRuleId: 'xvhtbgwP1Uh8XFucLD7j',
    name: 'Quiz Generic',
    description: 'General quiz generation formatting and quality standards.',
    tags: ['quiz', 'generic'],
    applicableTo: [RuleApplicability.QUIZ],
    color: RuleColor.ORANGE,
  },
  {
    platformId: 'bp-diagram-quiz-uniform',
    sourceRuleId: 'E6Jp2FfAL0Rb4QRwCWoW',
    name: 'Uniform Mermaid Diagram Quiz',
    description:
      'Accessible, visually uniform Mermaid diagram quizzes without predictable cues.',
    tags: ['diagram_quiz', 'mermaid'],
    applicableTo: [RuleApplicability.DIAGRAM_QUIZ],
    color: RuleColor.YELLOW,
  },
  {
    platformId: 'bp-sequence-quiz-generic',
    sourceRuleId: 'v835vWCuETlc5R61dxaR',
    name: 'Sequence Quiz Generic',
    description:
      'General sequence-ordering quiz generation with clear structural explanations.',
    tags: ['sequence_quiz', 'generic'],
    applicableTo: [RuleApplicability.SEQUENCE_QUIZ],
    color: RuleColor.PINK,
  },
  {
    platformId: 'bp-slide-deck-generation',
    sourceRuleId: 'brvpfEU3yMK3nBvGOq1Z',
    name: 'Slide Deck Generation',
    description:
      'Standard slide structure and styling for educational slide decks.',
    tags: ['slide_deck', 'education'],
    applicableTo: [RuleApplicability.SLIDE_DECK],
    color: RuleColor.BLUE,
  },
  {
    platformId: 'bp-flashcard-generic',
    sourceRuleId: '0jKa7iEBlkjbSMcHWwuv',
    name: 'Flashcard Generic Front',
    description:
      'Structured flashcard fronts with a concept emoji and simple inline icon.',
    tags: ['flashcard', 'generic'],
    applicableTo: [RuleApplicability.FLASHCARD],
    color: RuleColor.GREEN,
  },
  {
    platformId: 'bp-flashcard-desc-interactive',
    sourceRuleId: 'Ha7qNdLzlRMU4ixwkBrN',
    name: 'Flashcard Description Interactive',
    description:
      'Interactive HTML flashcard descriptions with concise code examples when relevant.',
    tags: ['flashcard_desc', 'interactive', 'html'],
    applicableTo: [RuleApplicability.FLASHCARD_DESC],
    color: RuleColor.INDIGO,
  },
  {
    platformId: 'bp-followup-summary',
    sourceRuleId: 'QhlSQpQ1Jkv3GJt6Ga90',
    name: 'Follow-up Summary',
    description:
      'Concise follow-up explanations with a short recap of core concepts.',
    tags: ['followup', 'summary'],
    applicableTo: [RuleApplicability.FOLLOWUP],
    color: RuleColor.GRAY,
  },
  {
    platformId: 'bp-chat-code-explanation',
    sourceRuleId: 'zW9i4FQTJZXWCf15nkMz',
    name: 'Chat Code Explanation',
    description:
      'Explain code snippets clearly in chat, with comparisons when helpful.',
    tags: ['chat', 'code'],
    applicableTo: [RuleApplicability.CHAT],
    color: RuleColor.PURPLE,
  },
  {
    platformId: 'bp-technical-doc-prompt',
    sourceRuleId: 'Qbuhe9HTfnOOzWDPuwMV',
    name: 'Technical Documentation Generator',
    description:
      'Comprehensive technical study document structure for prompt-driven generation.',
    tags: ['prompt', 'document', 'technical'],
    applicableTo: [RuleApplicability.PROMPT],
    color: RuleColor.BLUE,
  },
];

function parseArgs(): { dryRun: boolean; publish: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    publish: args.includes('--publish'),
  };
}

async function main(): Promise<void> {
  const { dryRun, publish } = parseArgs();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();
  const now = new Date().toISOString();

  const created: string[] = [];
  const skipped: string[] = [];

  for (const spec of BLUEPRINT_SEEDS) {
    const sourceDoc = await db
      .collection('users')
      .doc(SOURCE_USER_ID)
      .collection('rules')
      .doc(spec.sourceRuleId)
      .get();

    if (!sourceDoc.exists) {
      console.warn(`Skip ${spec.platformId}: source rule ${spec.sourceRuleId} not found`);
      skipped.push(spec.platformId);
      continue;
    }

    const source = sourceDoc.data() ?? {};
    const content = typeof source.content === 'string' ? source.content : '';
    if (!content) {
      console.warn(`Skip ${spec.platformId}: source rule has no content`);
      skipped.push(spec.platformId);
      continue;
    }

    const record: IRuleBlueprint = {
      id: spec.platformId,
      name: spec.name ?? (typeof source.name === 'string' ? source.name : spec.platformId),
      description:
        spec.description ??
        (typeof source.description === 'string' ? source.description : undefined),
      content,
      color:
        spec.color ??
        (Object.values(RuleColor).includes(source.color as RuleColor)
          ? (source.color as RuleColor)
          : RuleColor.PURPLE),
      tags: spec.tags ?? (Array.isArray(source.tags) ? source.tags : []),
      applicableTo:
        spec.applicableTo ??
        (Array.isArray(source.applicableTo)
          ? source.applicableTo.filter((value): value is RuleApplicability =>
              Object.values(RuleApplicability).includes(value as RuleApplicability),
            )
          : [RuleApplicability.PROMPT]),
      status: publish ? 'published' : 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-rule-blueprints',
      updatedBy: 'seed-rule-blueprints',
      sourceUserId: SOURCE_USER_ID,
      sourceRuleId: spec.sourceRuleId,
      ...(publish
        ? {
            publishedAt: now,
            publishedBy: 'seed-rule-blueprints',
          }
        : {}),
    };

    if (dryRun) {
      console.log(
        `[dry-run] ${record.id}: ${record.name} (${record.applicableTo.join(', ')}) status=${record.status}`,
      );
      continue;
    }

    await db.collection('platformRuleBlueprints').doc(record.id).set(record, {
      merge: true,
    });
    created.push(record.id);
    console.log(`Upserted ${record.id} (${record.name})`);
  }

  console.log(
    JSON.stringify(
      {
        projectId: PROJECT_ID,
        dryRun,
        publish,
        createdCount: created.length,
        skippedCount: skipped.length,
        created,
        skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

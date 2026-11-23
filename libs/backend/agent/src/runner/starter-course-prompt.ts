import { STARTER_COURSE_LIMITS } from '@shared-types';
import type { StarterCoursePhase } from '../tools/starter-course-tools';

export interface IStarterCoursePromptInput {
  /** `ask` on the first starter turn, `build` once the user answered. */
  phase: StarterCoursePhase;
  /** The instant sample folder, which the course must not use. */
  sampleDirectoryId?: string;
  /** The course folder, when an earlier starter turn already created it. */
  courseDirectoryId?: string;
  /** Free documents still available. */
  documentsRemaining: number;
}

const OVERRIDE_NOTE =
  'These rules override the propose-first, approval and credit-estimate rules above, and the planner rule to ask only when a request is ambiguous, for this conversation only.';

function buildAskLines(): string[] {
  return [
    'STARTER COURSE MODE, STEP 1 OF 2: ASK.',
    OVERRIDE_NOTE,
    'The user is new and just named, on the welcome screen, a subject they want to study. Their message is that subject. Before building anything, find out what kind of course fits them.',
    '- Reply with type "response" and a "questions" array of 2 or 3 questions. Do not plan steps and do not call any tools in this turn; folder and document tools are unavailable until the user answers.',
    '- Tailor the questions to the subject. Cover their current level (for example complete beginner, know the basics, intermediate), their goal or situation (for "Spanish for travel": where they are going or which situations matter), and what to focus on (for example key phrases, grammar, pronunciation; or theory versus hands-on practice).',
    '- Give each question 2 to 4 short options. Put the most likely option first and mark it "recommended": true. Keep each header to one or two words.',
    '- "response" is one short, friendly sentence, such as "Great choice! A few quick questions so the course fits you." Do not repeat the questions in it.',
  ];
}

function buildBuildLines(input: IStarterCoursePromptInput): string[] {
  const documents = Math.max(1, Math.min(input.documentsRemaining, STARTER_COURSE_LIMITS.maxDocuments));
  const lines = [
    'STARTER COURSE MODE, STEP 2 OF 2: BUILD.',
    OVERRIDE_NOTE,
    "The user's latest message answers the questions you asked about the subject they chose. A skipped question means: use beginner-friendly defaults.",
    '- Do not ask any more questions. Build the course now, without asking for approval and without quoting credits (it is free).',
  ];
  if (input.courseDirectoryId) {
    lines.push(
      `- The course folder already exists (id: ${input.courseDirectoryId}). Reuse it; do not create another folder.`,
    );
  } else {
    lines.push(
      '- Create one folder with create_directory, parentId "root", named after the subject (short, title case).',
    );
  }
  lines.push(
    `- Then call create_document exactly ${documents} time${documents === 1 ? '' : 's'} with that folder's directoryId. Shape the documents to the answers: the first is an overview at their level, the next covers what they said matters most. Give each a clear title and a detailed prompt that states the level, goal and focus.`,
    '- Do not create, attach or edit rules, and do not create quizzes or flashcards: formatting rules and a quiz are added automatically once the documents are ready.',
  );
  if (input.sampleDirectoryId) {
    lines.push(
      `- Never put the course in the sample folder (id: ${input.sampleDirectoryId}).`,
    );
  }
  lines.push(
    `- Free documents left in this course: ${input.documentsRemaining}. Do not create more than that.`,
    '- Final reply: two or three short sentences saying what you created and that the documents are being generated, with a quiz to follow. Do not list document ids.',
  );
  return lines;
}

/**
 * Extra system-prompt rules for the free onboarding starter course. The
 * first turn asks clarifying questions (shown as question cards); the course
 * is built from the answers on the next turn.
 */
export function buildStarterCoursePromptBlock(
  input: IStarterCoursePromptInput,
): string {
  const lines = input.phase === 'ask' ? buildAskLines() : buildBuildLines(input);
  return lines.join('\n');
}

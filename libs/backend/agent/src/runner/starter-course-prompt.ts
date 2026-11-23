import { STARTER_COURSE_LIMITS } from '@shared-types';

export interface IStarterCoursePromptInput {
  /** The instant sample folder, which the course must not use. */
  sampleDirectoryId?: string;
  /** The course folder, when an earlier starter turn already created it. */
  courseDirectoryId?: string;
  /** Free documents still available. */
  documentsRemaining: number;
}

/**
 * Extra system-prompt rules for the free onboarding starter course. The user
 * picked a subject on the welcome screen and expects a small course to appear
 * without further confirmation. These rules override the usual
 * "propose first" and credit-estimate rules for this conversation only.
 */
export function buildStarterCoursePromptBlock(
  input: IStarterCoursePromptInput,
): string {
  const documents = STARTER_COURSE_LIMITS.maxDocuments;
  const lines = [
    'STARTER COURSE MODE (overrides the propose-first, approval and credit-estimate rules above for this conversation):',
    'The user is new and chose a subject on the welcome screen. Their first message is the subject they want to study. Nothing is open in the UI.',
    `Build a small starter course now, without asking for approval and without quoting credits (it is free): one top-level folder and exactly ${documents} documents in it.`,
    '- If the subject is too vague to plan two useful documents (for example a single broad word), you may ask once, with at most two clarifying questions (such as level and focus). Never ask a second time: if Recent conversation already contains your questions, proceed with the answers, using beginner-friendly defaults for anything skipped.',
    '- Otherwise do not ask anything; assume a beginner who wants a practical introduction.',
    '- Create the folder with create_directory, parentId "root", named after the subject (short, title case).',
    `- Then call create_document exactly ${documents} times with that folder's directoryId: first a beginner overview of the subject, then the most useful next topic. Give each a clear title and a detailed prompt describing what it should cover.`,
    '- Do not create, attach or edit rules, and do not create quizzes or flashcards: formatting rules and a quiz are added automatically once the documents are ready.',
  ];
  if (input.sampleDirectoryId) {
    lines.push(
      `- Never put the course in the sample folder (id: ${input.sampleDirectoryId}).`,
    );
  }
  if (input.courseDirectoryId) {
    lines.push(
      `- The course folder already exists (id: ${input.courseDirectoryId}). Reuse it; do not create another folder.`,
    );
  }
  lines.push(
    `- Free documents left in this course: ${input.documentsRemaining}. Do not create more than that.`,
    '- Final reply: two or three short sentences saying what you created and that the documents are being generated, with a quiz to follow. Do not list document ids.',
  );
  return lines.join('\n');
}

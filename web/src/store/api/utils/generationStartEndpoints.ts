/**
 * RTK endpoints that only *start* a document or artifact generation.
 *
 * Each backing callable creates a pending record, enqueues a generation job and
 * returns `generationStatus: 'pending'`. The generation itself runs in a task
 * queue worker, and its outcome (success or failure) is written to the pending
 * record that the library already shows.
 *
 * A client-side `deadline-exceeded` on one of these requests therefore does not
 * mean the generation failed: the callable keeps running server-side after the
 * browser stops waiting, and a real failure still surfaces on the record (or via
 * the stale-generation sweep). These errors are not shown to the user.
 */
export const GENERATION_START_ENDPOINTS: ReadonlySet<string> = new Set([
  // Documents
  'createDocument',
  'createDocumentFromUrl',
  'createDocumentFromPastedText',
  'uploadAndCreateDocument',
  'generateFromPrompt',
  // Artifacts
  'generateQuiz',
  'generateFlashcards',
  'generateSlideDeck',
  'generateDiagramQuiz',
  'generateSequenceQuiz',
  'generateMatchQuiz',
]);

/** RTK error `status` produced by firebaseCallableBaseQuery for a timed-out callable. */
export const CALLABLE_DEADLINE_EXCEEDED_STATUS = 'functions/deadline-exceeded';

export function isGenerationStartDeadlineExceeded(
  endpointName: string | undefined,
  status: string | undefined,
): boolean {
  return (
    endpointName !== undefined &&
    GENERATION_START_ENDPOINTS.has(endpointName) &&
    status === CALLABLE_DEADLINE_EXCEEDED_STATUS
  );
}

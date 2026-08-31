/**
 * Firebase Functions for StudyForge
 *
 * Generation, billing, API keys, and External API remain on the server.
 * Library reads and non-generation mutations are handled client-side via Firestore.
 */

import './global-options';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Health check endpoint (HTTP for monitoring).
 */
export const healthCheck = onRequest(
  {
    cors: true,
  },
  async (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  },
);

// Generation — quizzes
export { generateQuiz } from './endpoints/quizzes';

export { processGenerationJob } from './tasks/process-generation-job';

export { sweepStaleGenerationsSchedule } from './tasks/sweep-stale-generations';

export { generateDiagramQuiz } from './endpoints/diagram-quizzes';

export { generateSequenceQuiz } from './endpoints/sequence-quizzes';

export { generateQuizFollowup } from './endpoints/quiz-followup';

export { askDocumentQuestion } from './endpoints/document-question';

export { reviseDocumentWithAI } from './endpoints/document-revise';

export { sendDirectoryChatMessage } from './endpoints/directory-chat';

// Document ingest and generation (not CRUD)
export {
  createDocument,
  createDocumentFromPastedText,
  uploadAndCreateDocument,
  createDocumentFromUrl,
  generateFromPrompt,
  generateFromScreenshot,
} from './endpoints/documents';

export { generateRuleWithAI } from './endpoints/rule-ai';

export { generateFlashcards } from './endpoints/flashcards';

export { generateSlideDeck } from './endpoints/slide-decks';

export { api } from './endpoints/external-api';

export { agentMessageStream } from './endpoints/agent-message-stream';

export {
  createApiKey,
  revokeApiKey,
  bulkRevokeApiKeys,
} from './endpoints/api-keys';

export { bootstrapUserProfileEndpoint as bootstrapUserProfile } from './endpoints/auth';

export {
  getUsageSummary,
  getRecentUsageEvents,
} from './endpoints/usage-summary';

export {
  createBillingCheckoutSessionEndpoint as createBillingCheckoutSession,
  createBillingPortalSessionEndpoint as createBillingPortalSession,
  listSubscriptionPlansEndpoint as listSubscriptionPlans,
  updatePayAsYouGoSettingsEndpoint as updatePayAsYouGoSettings,
  refreshUsageSummary,
  stripeBillingWebhook,
} from './endpoints/billing';

export { processMonthlyOverageInvoicesSchedule } from './tasks/process-monthly-overage-invoices';

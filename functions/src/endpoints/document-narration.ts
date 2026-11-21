import {
  onCall,
  HttpsError,
  type CallableRequest,
} from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import {
  documentNarrationRequestSchema,
  NARRATION_PRICE_CHANGED_CODE,
  startDocumentNarrationRequestSchema,
  type EvaluateDocumentNarratabilityResponse,
  type QuoteDocumentNarrationResponse,
  type RemoveDocumentNarrationResponse,
  type StartDocumentNarrationResponse,
} from '@shared-types';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { UsageLimitError } from '@study-forge/backend-core/services/usage-limits-service';
import { enforceCallableGenerationRateLimit } from '@study-forge/backend-generation/generation-rate-limit';
import { toCallableUsageLimitError } from '@study-forge/backend-generation/generation-limits';
import { judgeDocumentNarratability } from '@study-forge/backend-documents/narration/narratability-service';
import {
  NarrationPriceChangedError,
  NarrationUnavailableError,
  quoteDocumentNarration,
  startDocumentNarration,
} from '@study-forge/backend-documents/narration/narration-generation-service';
import { NarrationDocumentNotFoundError } from '@study-forge/backend-documents/narration/narration-source';
import { removeNarration } from '@study-forge/backend-documents/narration/narration-store';

const llmSettingsEncryptionKey = defineSecret('LLM_SETTINGS_ENCRYPTION_KEY');

const callableOptions = {
  region: 'asia-east1' as const,
  cors: true,
  secrets: [llmSettingsEncryptionKey],
  timeoutSeconds: 60,
  memory: '512MiB' as const,
};

/** What a `@shared-types` request schema offers; kept structural so any Zod major fits. */
interface IRequestSchema<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false };
}

function parseRequest<T>(
  schema: IRequestSchema<T>,
  request: CallableRequest<unknown>,
): T {
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'documentId is required');
  }
  return parsed.data;
}

function toHttpsError(error: unknown, logMessage: string): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof UsageLimitError) return toCallableUsageLimitError(error);
  if (error instanceof NarrationDocumentNotFoundError) {
    return new HttpsError('not-found', error.message);
  }
  if (error instanceof NarrationPriceChangedError) {
    return new HttpsError('failed-precondition', error.message, {
      code: NARRATION_PRICE_CHANGED_CODE,
      credits: error.credits,
    });
  }
  if (error instanceof NarrationUnavailableError) {
    return new HttpsError('failed-precondition', error.message, {
      reason: error.reason,
    });
  }
  logger.error(logMessage, {
    message: error instanceof Error ? error.message : String(error),
  });
  return new HttpsError(
    'internal',
    'Narration is temporarily unavailable. Try again later.',
  );
}

/**
 * Runs the narratable check for a document that has no current result. The
 * mobile reader calls it for documents judged before narration existed.
 */
export const evaluateDocumentNarratability = onCall(
  callableOptions,
  async (request): Promise<EvaluateDocumentNarratabilityResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const { documentId } = parseRequest(
        documentNarrationRequestSchema,
        request,
      );
      const result = await judgeDocumentNarratability({
        userId,
        documentId,
        // Only a check that asks the model counts; a stored result is free.
        beforeDecision: () =>
          enforceCallableGenerationRateLimit(
            userId,
            'documentNarratableDecision',
          ),
      });
      return {
        success: true,
        ...(result.narratability
          ? { narratability: result.narratability }
          : {}),
        ...(result.pending ? { pending: true } : {}),
      };
    } catch (error) {
      throw toHttpsError(error, 'Narratable check failed');
    }
  },
);

/** The credits generating a document's missing narration parts would cost. */
export const quoteDocumentNarrationEndpoint = onCall(
  callableOptions,
  async (request): Promise<QuoteDocumentNarrationResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const { documentId } = parseRequest(
        documentNarrationRequestSchema,
        request,
      );
      return {
        success: true,
        quote: await quoteDocumentNarration(userId, documentId),
      };
    } catch (error) {
      throw toHttpsError(error, 'Narration quote failed');
    }
  },
);

/** Charges the quoted credits and starts generating the missing parts. */
export const startDocumentNarrationEndpoint = onCall(
  callableOptions,
  async (request): Promise<StartDocumentNarrationResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const { documentId, expectedCredits } = parseRequest(
        startDocumentNarrationRequestSchema,
        request,
      );
      await enforceCallableGenerationRateLimit(userId, 'documentNarration');
      const result = await startDocumentNarration({
        userId,
        documentId,
        expectedCredits,
      });
      return { success: true, ...result };
    } catch (error) {
      throw toHttpsError(error, 'Narration start failed');
    }
  },
);

/** Deletes a document's narration audio and frees its storage. */
export const removeDocumentNarrationEndpoint = onCall(
  callableOptions,
  async (request): Promise<RemoveDocumentNarrationResponse> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const { documentId } = parseRequest(
        documentNarrationRequestSchema,
        request,
      );
      return {
        success: true,
        removed: await removeNarration(userId, documentId),
      };
    } catch (error) {
      throw toHttpsError(error, 'Narration removal failed');
    }
  },
);

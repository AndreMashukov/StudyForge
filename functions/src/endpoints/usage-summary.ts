import { onCall } from 'firebase-functions/v2/https';
import { validateVerifiedAuth } from '@study-forge/backend-core/lib/auth';
import { throwCallableError } from '@study-forge/backend-core/lib/callable-error';
import {
  getUserUsageSummary,
  listRecentUsageEvents,
} from '@study-forge/backend-core/services/usage-limits-service';
import type { ApiResponse, IUserUsageSummary } from '@shared-types';

export const getUsageSummary = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<IUserUsageSummary>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const summary = await getUserUsageSummary(userId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      throwCallableError(error, 'Failed to load usage summary');
    }
  }
);

export const getRecentUsageEvents = onCall(
  { region: 'asia-east1', cors: true },
  async (request): Promise<ApiResponse<Array<Record<string, unknown>>>> => {
    try {
      const userId = await validateVerifiedAuth(request);
      const limit = typeof request.data?.limit === 'number' ? request.data.limit : 20;
      const events = await listRecentUsageEvents(userId, Math.min(limit, 50));

      return {
        success: true,
        data: events,
      };
    } catch (error) {
      throwCallableError(error, 'Failed to load usage events');
    }
  }
);

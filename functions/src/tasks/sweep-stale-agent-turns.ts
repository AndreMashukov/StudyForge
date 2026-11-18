import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sweepStaleAgentTurns } from '@study-forge/backend-agent';

/** Fails agent turns whose worker died, so clients never wait forever. */
export const sweepStaleAgentTurnsSchedule = onSchedule(
  {
    region: 'asia-east1',
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
  },
  async () => {
    try {
      await sweepStaleAgentTurns();
    } catch (error) {
      logger.error('Stale agent turn sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

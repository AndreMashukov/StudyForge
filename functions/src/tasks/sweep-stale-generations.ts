import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sweepStaleGenerations } from '../services/stale-generation-sweeper';

export const sweepStaleGenerationsSchedule = onSchedule(
  {
    region: 'asia-east1',
    schedule: 'every 15 minutes',
    timeZone: 'UTC',
  },
  async () => {
    try {
      await sweepStaleGenerations();
    } catch (error) {
      logger.error('Stale generation sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
);

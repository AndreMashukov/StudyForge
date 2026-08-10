import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { processMonthlyOverageInvoices } from '@study-forge/backend-core/services/billing-service';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

export const processMonthlyOverageInvoicesSchedule = onSchedule(
  {
    region: 'asia-east1',
    schedule: '0 2 1 * *',
    timeZone: 'UTC',
    secrets: [stripeSecretKey],
  },
  async () => {
    try {
      const invoicedCount = await processMonthlyOverageInvoices(stripeSecretKey.value());
      logger.info('Processed monthly overage invoices', { invoicedCount });
    } catch (error) {
      logger.error('Monthly overage invoice processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { DEFAULT_PAYG_MONTHLY_CAP_CENTS } from '@shared-types';
import {
  useCreateBillingCheckoutSessionMutation,
  useCreateBillingPortalSessionMutation,
  useUpdatePayAsYouGoSettingsMutation,
} from '../../../../store/api/Billing/billingApi';
import { usageApi } from '../../../../store/api/Usage/usageApi';
import type { AppDispatch } from '../../../../store';
import type { IUsagePageHandlers } from '../../types/IUsagePageHandlers';

function parseMonthlyCapCents(value: string): number {
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return DEFAULT_PAYG_MONTHLY_CAP_CENTS;
  }
  return Math.round(dollars * 100);
}

function getBillingErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'message' in error.data &&
    typeof error.data.message === 'string'
  ) {
    return error.data.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Billing action failed. Please try again.';
}

export function useUsagePageHandlers(): IUsagePageHandlers {
  const dispatch = useDispatch<AppDispatch>();
  const [billingError, setBillingError] = useState<string | null>(null);
  const [createCheckout, checkoutState] = useCreateBillingCheckoutSessionMutation();
  const [createPortal, portalState] = useCreateBillingPortalSessionMutation();
  const [updatePayAsYouGo, updateState] = useUpdatePayAsYouGoSettingsMutation();

  const isSaving =
    checkoutState.isLoading || portalState.isLoading || updateState.isLoading;

  const refreshUsageSummary = () => {
    void dispatch(usageApi.endpoints.getUsageSummary.initiate(undefined, { forceRefetch: true }));
  };

  const clearBillingError = () => {
    setBillingError(null);
  };

  const handleSetupBilling = async () => {
    clearBillingError();
    try {
      const result = await createCheckout({ origin: window.location.origin }).unwrap();
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const handleManageBilling = async () => {
    clearBillingError();
    try {
      const result = await createPortal({ origin: window.location.origin }).unwrap();
      window.location.assign(result.portalUrl);
    } catch (error) {
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const handleEnablePayAsYouGo = async (monthlyCapDollars: string) => {
    clearBillingError();
    try {
      await updatePayAsYouGo({
        enabled: true,
        monthlyCapCents: parseMonthlyCapCents(monthlyCapDollars),
      }).unwrap();
      refreshUsageSummary();
    } catch (error) {
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const handleDisablePayAsYouGo = async (monthlyCapDollars: string) => {
    clearBillingError();
    try {
      await updatePayAsYouGo({
        enabled: false,
        monthlyCapCents: parseMonthlyCapCents(monthlyCapDollars),
      }).unwrap();
      refreshUsageSummary();
    } catch (error) {
      setBillingError(getBillingErrorMessage(error));
    }
  };

  return {
    isSaving,
    billingError,
    clearBillingError,
    handleSetupBilling,
    handleManageBilling,
    handleEnablePayAsYouGo,
    handleDisablePayAsYouGo,
  };
}

import { useState } from 'react';
import {
  useCreateBillingCheckoutSessionMutation,
  useCreateBillingPortalSessionMutation,
  useUpdatePayAsYouGoSettingsMutation,
} from '../../../../store/api/Billing/billingApi';
import type { IUsagePageHandlers } from '../../types/IUsagePageHandlers';
import {
  MONTHLY_CAP_ERROR_MESSAGE,
  monthlyCapDollarsToCents,
  parseMonthlyCapDollars,
} from '../../utils/usagePageUtils';

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
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isRedirectingToBilling, setIsRedirectingToBilling] = useState(false);
  const [createCheckout, checkoutState] = useCreateBillingCheckoutSessionMutation();
  const [createPortal, portalState] = useCreateBillingPortalSessionMutation();
  const [updatePayAsYouGo, updateState] = useUpdatePayAsYouGoSettingsMutation();

  const isSaving =
    checkoutState.isLoading ||
    portalState.isLoading ||
    updateState.isLoading ||
    isRedirectingToBilling;

  const clearBillingError = () => {
    setBillingError(null);
  };

  const handleSetupBilling = async (usageLimitsSetupId: string) => {
    clearBillingError();
    try {
      const result = await createCheckout({
        origin: window.location.origin,
        usageLimitsSetupId,
      }).unwrap();
      setIsRedirectingToBilling(true);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setIsRedirectingToBilling(false);
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const handleManageBilling = async () => {
    clearBillingError();
    try {
      const result = await createPortal({ origin: window.location.origin }).unwrap();
      setIsRedirectingToBilling(true);
      window.location.assign(result.portalUrl);
    } catch (error) {
      setIsRedirectingToBilling(false);
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const persistPayAsYouGoSettings = async (
    monthlyCapDollars: string,
    enabled: boolean,
  ) => {
    const parsed = parseMonthlyCapDollars(monthlyCapDollars);
    if (parsed === null) {
      setBillingError(MONTHLY_CAP_ERROR_MESSAGE);
      return;
    }

    clearBillingError();
    try {
      await updatePayAsYouGo({
        enabled,
        monthlyCapCents: monthlyCapDollarsToCents(parsed),
      }).unwrap();
    } catch (error) {
      setBillingError(getBillingErrorMessage(error));
    }
  };

  const handleEnablePayAsYouGo = async (monthlyCapDollars: string) => {
    await persistPayAsYouGoSettings(monthlyCapDollars, true);
  };

  const handleDisablePayAsYouGo = async (monthlyCapDollars: string) => {
    await persistPayAsYouGoSettings(monthlyCapDollars, false);
  };

  const handleUpdateMonthlyCap = async (monthlyCapDollars: string, enabled: boolean) => {
    await persistPayAsYouGoSettings(monthlyCapDollars, enabled);
  };

  return {
    isSaving,
    billingError,
    clearBillingError,
    handleSetupBilling,
    handleManageBilling,
    handleEnablePayAsYouGo,
    handleDisablePayAsYouGo,
    handleUpdateMonthlyCap,
  };
}

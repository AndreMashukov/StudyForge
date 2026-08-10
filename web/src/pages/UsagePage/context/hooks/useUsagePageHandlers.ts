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

export function useUsagePageHandlers(): IUsagePageHandlers {
  const dispatch = useDispatch<AppDispatch>();
  const [createCheckout, checkoutState] = useCreateBillingCheckoutSessionMutation();
  const [createPortal, portalState] = useCreateBillingPortalSessionMutation();
  const [updatePayAsYouGo, updateState] = useUpdatePayAsYouGoSettingsMutation();

  const isSaving =
    checkoutState.isLoading || portalState.isLoading || updateState.isLoading;

  const refreshUsageSummary = () => {
    void dispatch(usageApi.endpoints.getUsageSummary.initiate(undefined, { forceRefetch: true }));
  };

  const handleSetupBilling = async () => {
    const result = await createCheckout({ origin: window.location.origin }).unwrap();
    window.location.assign(result.checkoutUrl);
  };

  const handleManageBilling = async () => {
    const result = await createPortal({ origin: window.location.origin }).unwrap();
    window.location.assign(result.portalUrl);
  };

  const handleEnablePayAsYouGo = async (monthlyCapDollars: string) => {
    await updatePayAsYouGo({
      enabled: true,
      monthlyCapCents: parseMonthlyCapCents(monthlyCapDollars),
    }).unwrap();
    refreshUsageSummary();
  };

  const handleDisablePayAsYouGo = async (monthlyCapDollars: string) => {
    await updatePayAsYouGo({
      enabled: false,
      monthlyCapCents: parseMonthlyCapCents(monthlyCapDollars),
    }).unwrap();
    refreshUsageSummary();
  };

  return {
    isSaving,
    handleSetupBilling,
    handleManageBilling,
    handleEnablePayAsYouGo,
    handleDisablePayAsYouGo,
  };
}

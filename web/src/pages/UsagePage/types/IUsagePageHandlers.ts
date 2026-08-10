export interface IUsagePageHandlers {
  isSaving: boolean;
  billingError: string | null;
  clearBillingError: () => void;
  handleSetupBilling: () => Promise<void>;
  handleManageBilling: () => Promise<void>;
  handleEnablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
  handleDisablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
}

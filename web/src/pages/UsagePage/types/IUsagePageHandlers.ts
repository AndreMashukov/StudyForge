export interface IUsagePageHandlers {
  isSaving: boolean;
  handleSetupBilling: () => Promise<void>;
  handleManageBilling: () => Promise<void>;
  handleEnablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
  handleDisablePayAsYouGo: (monthlyCapDollars: string) => Promise<void>;
}

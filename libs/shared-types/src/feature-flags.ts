export interface IFeatureFlags {
  supportEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface IUpdateFeatureFlagsRequest {
  supportEnabled: boolean;
}

export function defaultFeatureFlags(isEmulator: boolean): IFeatureFlags {
  return { supportEnabled: isEmulator };
}

export function parseFeatureFlags(
  data: unknown,
  fallback: IFeatureFlags,
): IFeatureFlags {
  if (typeof data !== 'object' || data === null) {
    return fallback;
  }

  const supportEnabled = (data as { supportEnabled?: unknown }).supportEnabled;
  if (typeof supportEnabled !== 'boolean') {
    return fallback;
  }

  return { supportEnabled };
}

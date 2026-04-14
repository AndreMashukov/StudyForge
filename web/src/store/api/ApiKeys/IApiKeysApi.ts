export interface IApiKey {
  keyId: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

export interface ICreateApiKeyResponse {
  keyId: string;
  key: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

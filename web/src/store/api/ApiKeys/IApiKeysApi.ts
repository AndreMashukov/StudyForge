export type { IApiKey } from '@shared-types';

export interface ICreateApiKeyResponse {
  keyId: string;
  key: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
}

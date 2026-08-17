import { AsyncLocalStorage } from 'node:async_hooks';
import type { IProviderCostContext } from '@shared-types';
import { buildUsagePeriodKey } from '@shared-types';

const storage = new AsyncLocalStorage<IProviderCostContext>();

let callSequence = 0;

export function runWithProviderCostContext<T>(
  context: IProviderCostContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

export function getProviderCostContext(): IProviderCostContext | undefined {
  return storage.getStore();
}

export function patchProviderCostContext(
  patch: Partial<IProviderCostContext>,
): void {
  const current = storage.getStore();
  if (!current) {
    return;
  }
  Object.assign(current, patch);
}

export function nextProviderCallSequence(): number {
  callSequence += 1;
  return callSequence;
}

export function buildProviderCostContext(params: {
  userId: string;
  generationKind?: IProviderCostContext['generationKind'];
  reservationId?: string;
  jobId?: string;
  recordId?: string;
  threadId?: string;
  llmSetupId?: string;
  userGroupId?: string;
  workflow?: IProviderCostContext['workflow'];
  modality?: IProviderCostContext['modality'];
  callRole?: IProviderCostContext['callRole'];
  connectionId?: string;
  periodKey?: string;
}): IProviderCostContext {
  return {
    userId: params.userId,
    periodKey: params.periodKey ?? buildUsagePeriodKey(),
    generationKind: params.generationKind,
    reservationId: params.reservationId,
    jobId: params.jobId,
    recordId: params.recordId,
    threadId: params.threadId,
    llmSetupId: params.llmSetupId,
    userGroupId: params.userGroupId,
    workflow: params.workflow,
    modality: params.modality,
    callRole: params.callRole,
    connectionId: params.connectionId,
  };
}

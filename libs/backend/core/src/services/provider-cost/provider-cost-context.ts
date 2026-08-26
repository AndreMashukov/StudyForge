import { AsyncLocalStorage } from 'node:async_hooks';
import type { IProviderCostContext } from '@shared-types';
import {
  buildUsagePeriodKey,
  calculateAgentLoopCredits,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
} from '@shared-types';

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

export function getRunningAgentLoopCredits(): number {
  const context = storage.getStore();
  if (!context) {
    return 0;
  }

  return calculateAgentLoopCredits({
    knownCostUsd: context.loopKnownCostUsd ?? 0,
    unknownCallCount: context.loopUnknownCallCount ?? 0,
    pricePerCreditCents:
      context.pricePerCreditCents ?? DEFAULT_PRICE_PER_CREDIT_CENTS,
    reservedCredits: context.loopBudgetCredits ?? 0,
    billableEventCount: context.loopBillableEventCount ?? 0,
  });
}

export function isAgentLoopBudgetExhausted(): boolean {
  const context = storage.getStore();
  if (!context || !context.loopBudgetCredits || context.loopBudgetCredits <= 0) {
    return false;
  }
  return getRunningAgentLoopCredits() >= context.loopBudgetCredits;
}

export interface IBuildProviderCostContextParams {
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
  loopBudgetCredits?: number;
  pricePerCreditCents?: number;
}

export function buildProviderCostContext(
  params: IBuildProviderCostContextParams,
): IProviderCostContext {
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
    loopBudgetCredits: params.loopBudgetCredits,
    loopKnownCostUsd: 0,
    loopUnknownCallCount: 0,
    loopBillableEventCount: 0,
    pricePerCreditCents: params.pricePerCreditCents,
  };
}

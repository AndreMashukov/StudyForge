import { GenerationKind, resolveGenerationKind } from '@shared-types';
import {
  getGenerationRateLimitProfile,
  IGenerationRateLimitProfile,
} from './generation-rate-limit-profiles';

export interface IRateLimitState {
  lastRequestAtMs?: number;
  windowStartAtMs?: number;
  requestCount?: number;
}

export interface IRateLimitDecisionAllowed {
  allowed: true;
  nextState: {
    lastRequestAtMs: number;
    windowStartAtMs: number;
    requestCount: number;
  };
}

export interface IRateLimitDecisionBlocked {
  allowed: false;
  message: string;
  retryAfterSeconds: number;
}

export type RateLimitDecision = IRateLimitDecisionAllowed | IRateLimitDecisionBlocked;

const JOB_KIND_TO_GENERATION_KIND: Record<string, GenerationKind> = {
  slideDeck: 'slideDeckText',
  artifactAgent: 'diagramQuiz',
};

export function normalizeLimiterKey(limiterKey: string): string {
  return limiterKey.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function buildRateLimitDocId(
  generationKind: GenerationKind,
  limiterKey: string
): string {
  return `${generationKind}_${normalizeLimiterKey(limiterKey)}`;
}

export function resolveRateLimitGenerationKind(kind: string): GenerationKind {
  const mapped = JOB_KIND_TO_GENERATION_KIND[kind];
  if (mapped) {
    return mapped;
  }

  return resolveGenerationKind(kind);
}

export function evaluateRateLimitState(
  state: IRateLimitState | undefined,
  profile: IGenerationRateLimitProfile,
  now: number
): RateLimitDecision {
  const lastRequestAtMs = state?.lastRequestAtMs ?? 0;
  const cooldownRemainingMs = profile.cooldownMs - (now - lastRequestAtMs);
  if (lastRequestAtMs > 0 && cooldownRemainingMs > 0) {
    return {
      allowed: false,
      message: profile.cooldownMessage,
      retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
    };
  }

  const windowStartAtMs = state?.windowStartAtMs ?? now;
  const isCurrentWindow = now - windowStartAtMs < profile.windowMs;
  const requestCount = isCurrentWindow ? state?.requestCount ?? 0 : 0;

  if (requestCount >= profile.hourlyLimit) {
    const retryAfterMs = profile.windowMs - (now - windowStartAtMs);
    return {
      allowed: false,
      message: profile.hourlyMessage,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  return {
    allowed: true,
    nextState: {
      lastRequestAtMs: now,
      windowStartAtMs: isCurrentWindow ? windowStartAtMs : now,
      requestCount: requestCount + 1,
    },
  };
}

export function evaluateGenerationRateLimit(
  generationKind: GenerationKind,
  state: IRateLimitState | undefined,
  now: number
): RateLimitDecision {
  return evaluateRateLimitState(state, getGenerationRateLimitProfile(generationKind), now);
}

export interface IMultiBucketRateLimitAllowed {
  allowed: true;
  nextStates: Array<{
    lastRequestAtMs: number;
    windowStartAtMs: number;
    requestCount: number;
  }>;
}

export function evaluateMultiBucketRateLimitStates(
  states: Array<IRateLimitState | undefined>,
  profile: IGenerationRateLimitProfile,
  now: number
): IMultiBucketRateLimitAllowed | IRateLimitDecisionBlocked {
  const nextStates: IMultiBucketRateLimitAllowed['nextStates'] = [];

  for (const state of states) {
    const decision = evaluateRateLimitState(state, profile, now);
    if (decision.allowed === false) {
      return decision;
    }
    nextStates.push(decision.nextState);
  }

  return {
    allowed: true,
    nextStates,
  };
}

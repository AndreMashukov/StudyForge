import { GenerationKind } from '@shared-types';

export const ONE_HOUR_MS = 60 * 60 * 1000;

export interface IGenerationRateLimitProfile {
  cooldownMs: number;
  hourlyLimit: number;
  windowMs: number;
  cooldownMessage: string;
  hourlyMessage: string;
}

const PRODUCTION_PROFILE: IGenerationRateLimitProfile = {
  cooldownMs: 10_000,
  hourlyLimit: 60,
  windowMs: ONE_HOUR_MS,
  cooldownMessage: 'Generation is cooling down. Try again in a few seconds.',
  hourlyMessage: 'Hourly generation limit reached. Try again later.',
};

const INTERACTIVE_PROFILE: IGenerationRateLimitProfile = {
  cooldownMs: 3_000,
  hourlyLimit: 120,
  windowMs: ONE_HOUR_MS,
  cooldownMessage: 'Please wait a moment before sending another request.',
  hourlyMessage: 'Hourly interactive generation limit reached. Try again later.',
};

const VISION_PROFILE: IGenerationRateLimitProfile = {
  cooldownMs: 15_000,
  hourlyLimit: 30,
  windowMs: ONE_HOUR_MS,
  cooldownMessage: 'Screenshot capture is cooling down. Try again in a few seconds.',
  hourlyMessage: 'Screenshot capture hourly limit reached. Try again later.',
};

const SLIDE_DECK_TEXT_PROFILE: IGenerationRateLimitProfile = {
  cooldownMs: 15_000,
  hourlyLimit: 40,
  windowMs: ONE_HOUR_MS,
  cooldownMessage: 'Slide deck generation is cooling down. Try again in a few seconds.',
  hourlyMessage: 'Slide deck hourly generation limit reached. Try again later.',
};

const SLIDE_DECK_IMAGE_PROFILE: IGenerationRateLimitProfile = {
  cooldownMs: 30_000,
  hourlyLimit: 20,
  windowMs: ONE_HOUR_MS,
  cooldownMessage: 'Slide image generation is cooling down. Try again in a few seconds.',
  hourlyMessage: 'Slide image hourly generation limit reached. Try again later.',
};

export const GENERATION_RATE_LIMIT_PROFILES: Record<GenerationKind, IGenerationRateLimitProfile> = {
  quiz: PRODUCTION_PROFILE,
  flashcards: PRODUCTION_PROFILE,
  documentFromPrompt: PRODUCTION_PROFILE,
  documentFromScreenshot: VISION_PROFILE,
  quizFollowup: INTERACTIVE_PROFILE,
  documentQuestion: INTERACTIVE_PROFILE,
  documentRevise: INTERACTIVE_PROFILE,
  directoryChat: INTERACTIVE_PROFILE,
  diagramQuiz: PRODUCTION_PROFILE,
  sequenceQuiz: PRODUCTION_PROFILE,
  subjectWorld: PRODUCTION_PROFILE,
  slideDeckText: SLIDE_DECK_TEXT_PROFILE,
  slideDeckImage: SLIDE_DECK_IMAGE_PROFILE,
  sourceDocumentEnhancement: PRODUCTION_PROFILE,
  ruleGeneration: PRODUCTION_PROFILE,
};

export function getGenerationRateLimitProfile(
  generationKind: GenerationKind
): IGenerationRateLimitProfile {
  return GENERATION_RATE_LIMIT_PROFILES[generationKind];
}

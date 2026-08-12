/**
 * Named generation steps that need budgets finer than the 5 sampling profiles.
 * Call sites pass a flow id instead of hard-coding maxOutputTokens.
 */

export type LlmGenerationFlowId =
  | 'sequenceQuiz'
  | 'diagramQuiz.plan'
  | 'diagramQuiz.batch'
  | 'diagramQuiz.agent'
  | 'documentFromScreenshot'
  | 'slideDeck.imageBrief'
  | 'flashcards.plan'
  | 'flashcards.batch'
  | 'flashcards.languageClassify'
  | 'sourceDocumentEnhancement'
  | 'ruleGeneration'
  | 'screenshot.compliance'
  | 'screenshot.refine';

export const LLM_GENERATION_FLOW_IDS: LlmGenerationFlowId[] = [
  'sequenceQuiz',
  'diagramQuiz.plan',
  'diagramQuiz.batch',
  'diagramQuiz.agent',
  'documentFromScreenshot',
  'slideDeck.imageBrief',
  'flashcards.plan',
  'flashcards.batch',
  'flashcards.languageClassify',
  'sourceDocumentEnhancement',
  'ruleGeneration',
  'screenshot.compliance',
  'screenshot.refine',
];

export interface ILlmGenerationFlowOverrides {
  maxOutputTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  disableReasoning?: boolean;
  thinkingBudget?: number;
}

export type ILlmGenerationFlows = Partial<
  Record<LlmGenerationFlowId, ILlmGenerationFlowOverrides>
>;

export interface ILlmGenerationFlowMetadata {
  id: LlmGenerationFlowId;
  label: string;
  description: string;
  /** Sampling profile this flow inherits from when a field is unset. */
  profileId:
    | 'structuredArtifact'
    | 'explanatoryChat'
    | 'longformContent'
    | 'faithfulEdit'
    | 'deterministicUtility';
}

export const LLM_GENERATION_FLOW_METADATA: ILlmGenerationFlowMetadata[] = [
  {
    id: 'sequenceQuiz',
    label: 'Sequence quiz',
    description:
      'Full sequence-quiz JSON (8–12 questions). Raised for thinking models.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'diagramQuiz.plan',
    label: 'Diagram quiz plan',
    description: 'Compact question-plan phase before Mermaid batches.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'diagramQuiz.batch',
    label: 'Diagram quiz batch',
    description: 'Mermaid diagram batches for diagram quiz options.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'diagramQuiz.agent',
    label: 'Diagram quiz agent',
    description: 'Repair, rebalance, critic, and refine helpers.',
    profileId: 'deterministicUtility',
  },
  {
    id: 'documentFromScreenshot',
    label: 'Document from screenshot',
    description: 'Vision HTML generation from screenshots.',
    profileId: 'longformContent',
  },
  {
    id: 'slideDeck.imageBrief',
    label: 'Slide image brief',
    description: 'Short text brief before slide image generation.',
    profileId: 'longformContent',
  },
  {
    id: 'flashcards.plan',
    label: 'Flashcards plan',
    description: 'Term-plan phase for chunked flashcard generation.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'flashcards.batch',
    label: 'Flashcards batch',
    description: 'Batch expand phase for chunked flashcard generation.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'flashcards.languageClassify',
    label: 'Flashcards language classify',
    description: 'Tiny JSON classification before language-learning cards.',
    profileId: 'structuredArtifact',
  },
  {
    id: 'sourceDocumentEnhancement',
    label: 'Source document enhancement',
    description: 'Cleanup of extracted Markdown documents.',
    profileId: 'deterministicUtility',
  },
  {
    id: 'ruleGeneration',
    label: 'Rule generation',
    description: 'Directory rule drafting from topic/description.',
    profileId: 'faithfulEdit',
  },
  {
    id: 'screenshot.compliance',
    label: 'Screenshot compliance',
    description: 'Lightweight rule-compliance JSON review.',
    profileId: 'deterministicUtility',
  },
  {
    id: 'screenshot.refine',
    label: 'Screenshot refine',
    description: 'Full HTML rewrite to satisfy domain rules.',
    profileId: 'deterministicUtility',
  },
];

/**
 * Code seeds for flow budgets. Admin `flows` overrides beat these.
 * Values mirror the previous hard-coded call-site constants.
 */
export const DEFAULT_LLM_GENERATION_FLOWS: Record<
  LlmGenerationFlowId,
  ILlmGenerationFlowOverrides
> = {
  sequenceQuiz: { maxOutputTokens: 32_768 },
  'diagramQuiz.plan': { maxOutputTokens: 32_768 },
  'diagramQuiz.batch': { maxOutputTokens: 32_768 },
  'diagramQuiz.agent': { maxOutputTokens: 32_768 },
  documentFromScreenshot: { maxOutputTokens: 32_768 },
  'slideDeck.imageBrief': { maxOutputTokens: 4096 },
  'flashcards.plan': { maxOutputTokens: 8192 },
  'flashcards.batch': { maxOutputTokens: 12_288 },
  'flashcards.languageClassify': {
    maxOutputTokens: 1024,
    temperature: 0.1,
    disableReasoning: true,
  },
  sourceDocumentEnhancement: { maxOutputTokens: 16_384 },
  ruleGeneration: { maxOutputTokens: 8192 },
  'screenshot.compliance': { maxOutputTokens: 1024 },
  'screenshot.refine': { maxOutputTokens: 16_384, temperature: 0.3 },
};

export function isLlmGenerationFlowId(
  value: string,
): value is LlmGenerationFlowId {
  return (LLM_GENERATION_FLOW_IDS as string[]).includes(value);
}

export interface ILlmGenerationFlowBaseSettings {
  requestTimeoutMs: number;
  maxOutputTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  disableReasoning: boolean;
  thinkingBudget?: number;
}

/** Merge seed + admin flow overrides onto an already-resolved profile/global base. */
export function applyLlmGenerationFlowOverrides(
  base: ILlmGenerationFlowBaseSettings,
  flowId: LlmGenerationFlowId,
  storedFlows?: ILlmGenerationFlows,
): ILlmGenerationFlowBaseSettings {
  const seedFlow = DEFAULT_LLM_GENERATION_FLOWS[flowId];
  const storedFlow = storedFlows?.[flowId];

  const merged: ILlmGenerationFlowBaseSettings = {
    requestTimeoutMs: base.requestTimeoutMs,
    maxOutputTokens:
      storedFlow?.maxOutputTokens ??
      seedFlow.maxOutputTokens ??
      base.maxOutputTokens,
    temperature:
      storedFlow?.temperature ?? seedFlow.temperature ?? base.temperature,
    topK: storedFlow?.topK ?? seedFlow.topK ?? base.topK,
    topP: storedFlow?.topP ?? seedFlow.topP ?? base.topP,
    disableReasoning:
      storedFlow?.disableReasoning ??
      seedFlow.disableReasoning ??
      base.disableReasoning,
  };

  const thinkingBudget =
    storedFlow?.thinkingBudget ??
    seedFlow.thinkingBudget ??
    base.thinkingBudget;
  if (thinkingBudget !== undefined) {
    merged.thinkingBudget = thinkingBudget;
  }

  return merged;
}

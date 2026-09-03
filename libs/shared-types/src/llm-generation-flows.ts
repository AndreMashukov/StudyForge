/**
 * Named generation steps with admin-overridable budgets.
 * Resolve order: admin flow override → code seed → global defaults.
 * Call sites pass a flow id (or a code-only profile when no step preset exists).
 */

export type LlmGenerationFlowId =
  | 'sequenceQuiz'
  | 'matchQuiz'
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
  'matchQuiz',
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
}

export const LLM_GENERATION_FLOW_METADATA: ILlmGenerationFlowMetadata[] = [
  {
    id: 'sequenceQuiz',
    label: 'Sequence quiz',
    description:
      'Full sequence-quiz JSON (8–12 questions). Raised for thinking models.',
  },
  {
    id: 'matchQuiz',
    label: 'Match quiz',
    description:
      'Full match-quiz JSON (5 questions with prompts and option banks).',
  },
  {
    id: 'diagramQuiz.plan',
    label: 'Diagram quiz plan',
    description: 'Compact question-plan phase before Mermaid batches.',
  },
  {
    id: 'diagramQuiz.batch',
    label: 'Diagram quiz batch',
    description: 'Mermaid diagram batches for diagram quiz options.',
  },
  {
    id: 'diagramQuiz.agent',
    label: 'Diagram quiz agent',
    description: 'Repair, rebalance, critic, and refine helpers.',
  },
  {
    id: 'documentFromScreenshot',
    label: 'Document from screenshot',
    description: 'Vision HTML generation from screenshots.',
  },
  {
    id: 'slideDeck.imageBrief',
    label: 'Slide image brief',
    description: 'Short text brief before slide image generation.',
  },
  {
    id: 'flashcards.plan',
    label: 'Flashcards plan',
    description: 'Term-plan phase for chunked flashcard generation.',
  },
  {
    id: 'flashcards.batch',
    label: 'Flashcards batch',
    description: 'Batch expand phase for chunked flashcard generation.',
  },
  {
    id: 'flashcards.languageClassify',
    label: 'Flashcards language classify',
    description: 'Tiny JSON classification before language-learning cards.',
  },
  {
    id: 'sourceDocumentEnhancement',
    label: 'Source document enhancement',
    description: 'Faithful conversion of uploaded, pasted, or scraped source material to HTML.',
  },
  {
    id: 'ruleGeneration',
    label: 'Rule generation',
    description: 'Directory rule drafting from topic/description.',
  },
  {
    id: 'screenshot.compliance',
    label: 'Screenshot compliance',
    description: 'Lightweight rule-compliance JSON review.',
  },
  {
    id: 'screenshot.refine',
    label: 'Screenshot refine',
    description: 'Full HTML rewrite to satisfy domain rules.',
  },
];

/**
 * Code seeds for each generation step.
 * Former named-profile sampling values are baked in so resolve is step → global.
 * Admin `flows` overrides beat these.
 */
export const DEFAULT_LLM_GENERATION_FLOWS: Record<
  LlmGenerationFlowId,
  Required<
    Pick<
      ILlmGenerationFlowOverrides,
      'maxOutputTokens' | 'temperature' | 'disableReasoning'
    >
  > &
    ILlmGenerationFlowOverrides
> = {
  sequenceQuiz: {
    maxOutputTokens: 32_768,
    temperature: 0.4,
    disableReasoning: true,
  },
  matchQuiz: {
    maxOutputTokens: 32_768,
    temperature: 0.4,
    disableReasoning: true,
  },
  'diagramQuiz.plan': {
    maxOutputTokens: 32_768,
    temperature: 0.4,
    disableReasoning: true,
  },
  'diagramQuiz.batch': {
    maxOutputTokens: 32_768,
    temperature: 0.4,
    disableReasoning: true,
  },
  'diagramQuiz.agent': {
    maxOutputTokens: 32_768,
    temperature: 0.2,
    disableReasoning: false,
  },
  documentFromScreenshot: {
    maxOutputTokens: 32_768,
    temperature: 0.7,
    disableReasoning: true,
  },
  'slideDeck.imageBrief': {
    maxOutputTokens: 4096,
    temperature: 0.7,
    disableReasoning: true,
  },
  'flashcards.plan': {
    maxOutputTokens: 8192,
    temperature: 0.4,
    disableReasoning: true,
  },
  'flashcards.batch': {
    maxOutputTokens: 12_288,
    temperature: 0.4,
    disableReasoning: true,
  },
  'flashcards.languageClassify': {
    maxOutputTokens: 1024,
    temperature: 0.1,
    disableReasoning: true,
  },
  sourceDocumentEnhancement: {
    maxOutputTokens: 32_768,
    temperature: 0.2,
    disableReasoning: false,
  },
  ruleGeneration: {
    maxOutputTokens: 8192,
    temperature: 0.5,
    disableReasoning: false,
  },
  'screenshot.compliance': {
    maxOutputTokens: 1024,
    temperature: 0.2,
    disableReasoning: false,
  },
  'screenshot.refine': {
    maxOutputTokens: 16_384,
    temperature: 0.3,
    disableReasoning: false,
  },
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

/** Merge seed + admin flow overrides onto global defaults (step → global). */
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

export type LlmModality =
  | 'text'
  | 'vision'
  | 'image'
  | 'embedding'
  | 'decision';

const LLM_MODALITY_VALUES: readonly LlmModality[] = [
  'text',
  'vision',
  'image',
  'embedding',
  'decision',
];

export function isLlmModality(value: unknown): value is LlmModality {
  return LLM_MODALITY_VALUES.some((modality) => modality === value);
}

/**
 * Default model for the prompt diagram check. Decision models are served by the
 * OpenRouter Decisions API, not by chat completions.
 */
export const DEFAULT_PROMPT_DIAGRAM_DECISION_MODEL = 'typesafe/jev-1.13';

export type GenerationKind =
  | 'quiz'
  | 'flashcards'
  | 'documentFromPrompt'
  | 'promptDiagramDecision'
  | 'documentFromScreenshot'
  | 'documentQuestion'
  | 'scratchPadQuestion'
  | 'documentRevise'
  | 'directoryScopedAgent'
  | 'diagramQuiz'
  | 'escalation'
  | 'sequenceQuiz'
  | 'matchQuiz'
  | 'slideDeckText'
  | 'slideDeckImage'
  | 'sourceDocumentEnhancement'
  | 'ruleGeneration'
  | 'directoryAgent'
  | 'agentExecutor'
  | 'agentKnowledgeEmbedding';

export type GenerationWorkflow = 'direct' | 'directWithRepair' | 'agentic';

export interface IGenerationKindMetadata {
  kind: GenerationKind;
  label: string;
  description: string;
  requiredModality: LlmModality;
  supportedWorkflows: GenerationWorkflow[];
  defaultWorkflow: GenerationWorkflow;
  group: 'production' | 'interactive' | 'slideDeck';
}

export const ALL_GENERATION_KINDS: GenerationKind[] = [
  'quiz',
  'flashcards',
  'documentFromPrompt',
  'promptDiagramDecision',
  'documentFromScreenshot',
  'documentQuestion',
  'scratchPadQuestion',
  'documentRevise',
  'directoryScopedAgent',
  'diagramQuiz',
  'escalation',
  'sequenceQuiz',
  'matchQuiz',
  'slideDeckText',
  'slideDeckImage',
  'sourceDocumentEnhancement',
  'ruleGeneration',
  'directoryAgent',
  'agentExecutor',
  'agentKnowledgeEmbedding',
];

/** Generation kinds shown and edited in the admin LLM setup form. */
export const ADMIN_CONFIGURABLE_GENERATION_KINDS = ALL_GENERATION_KINDS;

export const GENERATION_KIND_METADATA: Record<
  GenerationKind,
  IGenerationKindMetadata
> = {
  documentFromPrompt: {
    kind: 'documentFromPrompt',
    label: 'Document from prompt',
    description:
      'Generate HTML documents from a user prompt. Direct: one LLM call. Direct with repair: one call plus validation-gated repair. Agentic: ADK pipeline with repair and critic loops.',
    requiredModality: 'text',
    supportedWorkflows: ['direct', 'directWithRepair', 'agentic'],
    defaultWorkflow: 'agentic',
    group: 'production',
  },
  promptDiagramDecision: {
    kind: 'promptDiagramDecision',
    label: 'Prompt diagram check',
    description:
      'Decision model that judges whether Mermaid diagrams fit an AI Prompt and how many to allow. Uses the OpenRouter Decisions API.',
    requiredModality: 'decision',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  documentFromScreenshot: {
    kind: 'documentFromScreenshot',
    label: 'Document from screenshot',
    description:
      'Transcribe screenshot images into HTML documents. Direct: one vision call. Direct with repair: vision call plus validation-gated text repair. Agentic: ADK HTML pipeline.',
    requiredModality: 'vision',
    supportedWorkflows: ['direct', 'directWithRepair', 'agentic'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  quiz: {
    kind: 'quiz',
    label: 'Quiz',
    description: 'Multiple-choice quiz generation from source documents.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  flashcards: {
    kind: 'flashcards',
    label: 'Flashcards',
    description:
      'Front/back flashcard set generation via the artifact agent platform.',
    requiredModality: 'text',
    supportedWorkflows: ['agentic'],
    defaultWorkflow: 'agentic',
    group: 'production',
  },
  diagramQuiz: {
    kind: 'diagramQuiz',
    label: 'Diagram quiz',
    description: 'Mermaid diagram quiz via the artifact agent platform.',
    requiredModality: 'text',
    supportedWorkflows: ['agentic'],
    defaultWorkflow: 'agentic',
    group: 'production',
  },
  escalation: {
    kind: 'escalation',
    label: 'Escalation',
    description:
      'Model for diagram-quiz repair, critic, and refiner after the same diagram has failed repair twice.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  sequenceQuiz: {
    kind: 'sequenceQuiz',
    label: 'Sequence quiz',
    description: 'Ordering quiz generation.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  matchQuiz: {
    kind: 'matchQuiz',
    label: 'Match quiz',
    description: 'Match-the-pairs quiz generation with option chip banks.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  slideDeckText: {
    kind: 'slideDeckText',
    label: 'Slide deck outline',
    description: 'Slide outline and speaker notes generation.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'slideDeck',
  },
  slideDeckImage: {
    kind: 'slideDeckImage',
    label: 'Slide deck images',
    description: 'Per-slide image generation.',
    requiredModality: 'image',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'slideDeck',
  },
  sourceDocumentEnhancement: {
    kind: 'sourceDocumentEnhancement',
    label: 'Source document enhancement',
    description: 'Faithful conversion of uploaded, pasted, or scraped source material to HTML.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  ruleGeneration: {
    kind: 'ruleGeneration',
    label: 'Rule generation',
    description: 'AI-assisted rule authoring.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'production',
  },
  directoryScopedAgent: {
    kind: 'directoryScopedAgent',
    label: 'Directory-scoped agent',
    description:
      'LangGraph plan-execute agent for directory-scoped AgentPanel chat (one directory tree).',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  documentQuestion: {
    kind: 'documentQuestion',
    label: 'Document question',
    description: 'Interactive Q&A about a single document.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  scratchPadQuestion: {
    kind: 'scratchPadQuestion',
    label: 'Scratch pad question',
    description:
      'Replace a single section scratch pad recall question and answer.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  documentRevise: {
    kind: 'documentRevise',
    label: 'Document revise',
    description: 'AI-assisted revision of an existing document.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  directoryAgent: {
    kind: 'directoryAgent',
    label: 'Workspace agent',
    description:
      'Floating workspace agent planner. LangGraph plan-execute uses this model for planning and final replies.',
    requiredModality: 'text',
    supportedWorkflows: ['direct', 'agentic'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  agentExecutor: {
    kind: 'agentExecutor',
    label: 'Workspace agent executor',
    description:
      'Executor model for workspace plan-execute steps in the LangGraph agent.',
    requiredModality: 'text',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
  agentKnowledgeEmbedding: {
    kind: 'agentKnowledgeEmbedding',
    label: 'Agent knowledge embedding',
    description:
      'Embedding model for agent RAG indexing and semantic memory retrieval.',
    requiredModality: 'embedding',
    supportedWorkflows: ['direct'],
    defaultWorkflow: 'direct',
    group: 'interactive',
  },
};

/** Internal capability aliases inherit the parent generation kind route at runtime. */
export const GENERATION_KIND_ALIASES: Record<string, GenerationKind> = {
  diagramQuizAgent: 'diagramQuiz',
  slideDeckImageBrief: 'slideDeckText',
};

export function resolveGenerationKind(kind: string): GenerationKind {
  const alias = GENERATION_KIND_ALIASES[kind];
  if (alias) {
    return alias;
  }

  if (kind in GENERATION_KIND_METADATA) {
    return kind as GenerationKind;
  }

  throw new Error(`Unknown generation kind: ${kind}`);
}

export function isGenerationKind(value: string): value is GenerationKind {
  return value in GENERATION_KIND_METADATA;
}

/** Label for a kind that no longer exists but still appears on past usage and cost records. */
export const RETIRED_GENERATION_KIND_LABEL = 'Retired feature';

/**
 * Display label for a generation kind read from stored records. Removed kinds
 * (e.g. `directoryChat`, `quizFollowup`) return {@link RETIRED_GENERATION_KIND_LABEL}.
 */
export function getGenerationKindLabel(value: string): string {
  return isGenerationKind(value)
    ? GENERATION_KIND_METADATA[value].label
    : RETIRED_GENERATION_KIND_LABEL;
}

export function isGenerationWorkflow(
  value: string,
): value is GenerationWorkflow {
  return (
    value === 'direct' || value === 'directWithRepair' || value === 'agentic'
  );
}

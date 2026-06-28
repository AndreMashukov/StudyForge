import type {
  GenerationKind,
  GenerationWorkflow,
  IGenerationRoutes,
  IProviderConnectionCatalogEntry,
  LlmModality,
} from '@shared-types';
import {
  ALL_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
  isGenerationWorkflow,
} from '@shared-types';
import { z } from 'zod';

const generationRouteFormEntrySchema = z.object({
  connectionId: z.string().trim().min(1, 'Provider connection is required'),
  model: z.string().trim().min(1, 'Model is required'),
  workflow: z.enum(['direct', 'agentic']),
});

const generationRoutesShape = Object.fromEntries(
  ALL_GENERATION_KINDS.map((kind) => [kind, generationRouteFormEntrySchema])
) as Record<GenerationKind, typeof generationRouteFormEntrySchema>;

export const llmSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  generationRoutes: z.object(generationRoutesShape),
});

export type ILlmSetupFormValues = z.infer<typeof llmSetupFormSchema>;

export function createEmptyGenerationRouteFormValues(): Record<
  GenerationKind,
  { connectionId: string; model: string; workflow: GenerationWorkflow }
> {
  const routes = {} as Record<
    GenerationKind,
    { connectionId: string; model: string; workflow: GenerationWorkflow }
  >;

  for (const kind of ALL_GENERATION_KINDS) {
    routes[kind] = {
      connectionId: '',
      model: '',
      workflow: GENERATION_KIND_METADATA[kind].defaultWorkflow,
    };
  }

  return routes;
}

export function toGenerationRoutes(values: ILlmSetupFormValues): IGenerationRoutes {
  const routes = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    const entry = values.generationRoutes[kind];
    const metadata = GENERATION_KIND_METADATA[kind];
    routes[kind] = {
      connectionId: entry.connectionId.trim(),
      model: entry.model.trim(),
      modality: metadata.requiredModality,
      workflow: entry.workflow,
    };
  }

  return routes;
}

export function generationRoutesToFormValues(
  name: string,
  description: string | undefined,
  generationRoutes: IGenerationRoutes
): ILlmSetupFormValues {
  const routes = createEmptyGenerationRouteFormValues();

  for (const kind of ALL_GENERATION_KINDS) {
    const route = generationRoutes[kind];
    routes[kind] = {
      connectionId: route.connectionId,
      model: route.model,
      workflow: route.workflow,
    };
  }

  return {
    name,
    description: description ?? '',
    generationRoutes: routes,
  };
}

export function filterConnectionsForModality(
  connections: IProviderConnectionCatalogEntry[],
  modality: LlmModality
): IProviderConnectionCatalogEntry[] {
  return connections.filter((connection) => connection.supportedModalities.includes(modality));
}

export function getGenerationKindGroups(): Array<{
  id: 'production' | 'interactive' | 'slideDeck';
  label: string;
  kinds: GenerationKind[];
}> {
  return [
    {
      id: 'production',
      label: 'Production generation',
      kinds: ALL_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'production'
      ),
    },
    {
      id: 'interactive',
      label: 'Interactive',
      kinds: ALL_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'interactive'
      ),
    },
    {
      id: 'slideDeck',
      label: 'Slide deck',
      kinds: ALL_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'slideDeck'
      ),
    },
  ];
}

export function getSupportedWorkflowOptions(kind: GenerationKind): GenerationWorkflow[] {
  return GENERATION_KIND_METADATA[kind].supportedWorkflows;
}

export function isWorkflowOptionDisabled(
  kind: GenerationKind,
  workflow: GenerationWorkflow
): boolean {
  return !GENERATION_KIND_METADATA[kind].supportedWorkflows.includes(workflow);
}

export function parseWorkflowValue(value: string): GenerationWorkflow {
  if (isGenerationWorkflow(value)) {
    return value;
  }

  return 'direct';
}

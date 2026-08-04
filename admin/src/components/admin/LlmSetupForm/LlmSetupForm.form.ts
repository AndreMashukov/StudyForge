import type {
  GenerationKind,
  GenerationWorkflow,
  IGenerationRoutes,
  IProviderConnectionCatalogEntry,
  LlmModality,
} from '@shared-types';
import {
  ADMIN_CONFIGURABLE_GENERATION_KINDS,
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
  ADMIN_CONFIGURABLE_GENERATION_KINDS.map((kind) => [kind, generationRouteFormEntrySchema])
) as Record<
  Exclude<GenerationKind, 'directoryAgent'>,
  typeof generationRouteFormEntrySchema
>;

export const llmSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  generationRoutes: z.object(generationRoutesShape),
});

export type ILlmSetupFormValues = z.infer<typeof llmSetupFormSchema>;

export type IAdminConfigurableGenerationKind = Exclude<GenerationKind, 'directoryAgent'>;

export function createEmptyGenerationRouteFormValues(): Record<
  IAdminConfigurableGenerationKind,
  { connectionId: string; model: string; workflow: GenerationWorkflow }
> {
  const routes = {} as Record<
    IAdminConfigurableGenerationKind,
    { connectionId: string; model: string; workflow: GenerationWorkflow }
  >;

  for (const kind of ADMIN_CONFIGURABLE_GENERATION_KINDS) {
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

  for (const kind of ADMIN_CONFIGURABLE_GENERATION_KINDS) {
    const entry = values.generationRoutes[kind];
    const metadata = GENERATION_KIND_METADATA[kind];
    routes[kind] = {
      connectionId: entry.connectionId.trim(),
      model: entry.model.trim(),
      modality: metadata.requiredModality,
      workflow: entry.workflow,
    };
  }

  const agentChatRoute = routes.directoryChat;
  routes.directoryAgent = {
    connectionId: agentChatRoute.connectionId,
    model: agentChatRoute.model,
    modality: 'text',
    workflow: agentChatRoute.workflow,
  };

  return routes;
}

export function generationRoutesToFormValues(
  name: string,
  description: string | undefined,
  generationRoutes: IGenerationRoutes
): ILlmSetupFormValues {
  const routes = createEmptyGenerationRouteFormValues();

  for (const kind of ADMIN_CONFIGURABLE_GENERATION_KINDS) {
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
  kinds: IAdminConfigurableGenerationKind[];
}> {
  return [
    {
      id: 'production',
      label: 'Production generation',
      kinds: ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'production'
      ),
    },
    {
      id: 'interactive',
      label: 'Interactive',
      kinds: ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
        (kind) => GENERATION_KIND_METADATA[kind].group === 'interactive'
      ),
    },
    {
      id: 'slideDeck',
      label: 'Slide deck',
      kinds: ADMIN_CONFIGURABLE_GENERATION_KINDS.filter(
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

const DOCUMENT_WORKFLOW_KINDS: ReadonlySet<GenerationKind> = new Set([
  'documentFromPrompt',
  'documentFromScreenshot',
]);

export function formatWorkflowOptionLabel(
  kind: GenerationKind,
  workflow: GenerationWorkflow
): string {
  if (!DOCUMENT_WORKFLOW_KINDS.has(kind)) {
    return workflow;
  }

  if (workflow === 'direct') {
    return 'direct — single-pass HTML (faster)';
  }

  return 'agentic — ADK repair/critic pipeline';
}

export function getWorkflowHelpText(kind: GenerationKind): string | null {
  if (kind === 'documentFromPrompt') {
    return 'Direct runs one text generation call, validates HTML, then stores. Agentic runs plan, draft, repair, and critic/refiner loops (~4+ minutes).';
  }

  if (kind === 'documentFromScreenshot') {
    return 'Direct runs one vision call, validates HTML, then stores. Agentic runs the full ADK HTML pipeline.';
  }

  return null;
}

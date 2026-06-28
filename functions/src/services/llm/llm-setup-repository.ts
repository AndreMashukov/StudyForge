import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type {
  GenerationKind,
  GenerationWorkflow,
  IGenerationRoute,
  IGenerationRoutes,
  ILlmSetup,
  IUserGroup,
  LlmModality,
} from '@shared-types';
import {
  ALL_GENERATION_KINDS,
  GENERATION_KIND_METADATA,
  isGenerationWorkflow,
} from '@shared-types';
import {
  createGenerationRouteNotConfiguredError,
  createLlmSetupNotFoundError,
  createUserGroupNotAssignedError,
  createUserGroupNotFoundError,
} from './llm-routing-error';
import { resolveProviderConnectionRoute } from './provider-connection-resolver';
import type { ResolvedRoute } from './types';

const LLM_SETUPS_COLLECTION = 'llmSetups';
const USER_GROUPS_COLLECTION = 'userGroups';
const USERS_COLLECTION = 'users';

export interface IUserRoutingContext {
  userId: string;
  userGroupId: string;
  group: IUserGroup;
  setup: ILlmSetup;
}

export interface SetupGenerationRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId: string;
  llmSetupId: string;
  kind: GenerationKind;
  workflow: GenerationWorkflow;
  modality: LlmModality;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGenerationRoute(value: unknown): IGenerationRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const modality = value.modality;
  const workflow = value.workflow;

  if (
    !connectionId ||
    !model ||
    (modality !== 'text' && modality !== 'vision' && modality !== 'image') ||
    typeof workflow !== 'string' ||
    !isGenerationWorkflow(workflow)
  ) {
    return null;
  }

  return {
    connectionId,
    model,
    modality,
    workflow,
  };
}

function parseGenerationRoutes(value: unknown): IGenerationRoutes | null {
  if (!isRecord(value)) {
    return null;
  }

  const routes = {} as IGenerationRoutes;

  for (const kind of ALL_GENERATION_KINDS) {
    const route = parseGenerationRoute(value[kind]);
    if (!route) {
      return null;
    }
    routes[kind] = route;
  }

  return routes;
}

function parseLlmSetup(id: string, data: FirebaseFirestore.DocumentData): ILlmSetup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const generationRoutes = parseGenerationRoutes(data.generationRoutes);

  if (!name || !generationRoutes) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    generationRoutes,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

function parseUserGroup(id: string, data: FirebaseFirestore.DocumentData): IUserGroup | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const llmSetupId = typeof data.llmSetupId === 'string' ? data.llmSetupId.trim() : '';

  if (!name || !llmSetupId) {
    return null;
  }

  return {
    id,
    name,
    llmSetupId,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

export class LlmSetupRepository {
  static async resolveUserRoutingContext(userId: string): Promise<IUserRoutingContext> {
    const userSnapshot = await admin.firestore().collection(USERS_COLLECTION).doc(userId).get();
    const userData = userSnapshot.data();
    const userGroupId =
      typeof userData?.userGroupId === 'string' ? userData.userGroupId.trim() : '';

    if (!userGroupId) {
      throw createUserGroupNotAssignedError(userId);
    }

    const groupSnapshot = await admin
      .firestore()
      .collection(USER_GROUPS_COLLECTION)
      .doc(userGroupId)
      .get();

    if (!groupSnapshot.exists) {
      throw createUserGroupNotFoundError(userId, userGroupId);
    }

    const group = parseUserGroup(groupSnapshot.id, groupSnapshot.data() ?? {});
    if (!group) {
      throw createUserGroupNotFoundError(userId, userGroupId);
    }

    const setupSnapshot = await admin
      .firestore()
      .collection(LLM_SETUPS_COLLECTION)
      .doc(group.llmSetupId)
      .get();

    if (!setupSnapshot.exists) {
      throw createLlmSetupNotFoundError(userId, userGroupId, group.llmSetupId);
    }

    const setup = parseLlmSetup(setupSnapshot.id, setupSnapshot.data() ?? {});
    if (!setup) {
      throw createLlmSetupNotFoundError(userId, userGroupId, group.llmSetupId);
    }

    return {
      userId,
      userGroupId,
      group,
      setup,
    };
  }

  static async resolveGenerationRoute(
    userId: string,
    kind: GenerationKind
  ): Promise<SetupGenerationRouteResolution> {
    const context = await this.resolveUserRoutingContext(userId);
    const generationRoute = context.setup.generationRoutes[kind];
    const metadata = GENERATION_KIND_METADATA[kind];

    if (!generationRoute) {
      throw createGenerationRouteNotConfiguredError(
        userId,
        context.userGroupId,
        context.setup.id,
        kind
      );
    }

    if (generationRoute.modality !== metadata.requiredModality) {
      throw createGenerationRouteNotConfiguredError(
        userId,
        context.userGroupId,
        context.setup.id,
        kind,
        `Generation route ${kind} has invalid modality ${generationRoute.modality}.`
      );
    }

    if (!metadata.supportedWorkflows.includes(generationRoute.workflow)) {
      throw createGenerationRouteNotConfiguredError(
        userId,
        context.userGroupId,
        context.setup.id,
        kind,
        `Generation route ${kind} workflow ${generationRoute.workflow} is not supported.`
      );
    }

    functions.logger.info('Resolving generation route', {
      userId,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      kind,
      workflow: generationRoute.workflow,
      modality: generationRoute.modality,
      connectionId: generationRoute.connectionId,
      model: generationRoute.model,
    });

    const resolution = await resolveProviderConnectionRoute({
      connectionId: generationRoute.connectionId,
      model: generationRoute.model,
      modality: generationRoute.modality,
      userId: context.userId,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
    });

    return {
      route: resolution.route,
      providerApiKey: resolution.providerApiKey,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      kind,
      workflow: generationRoute.workflow,
      modality: generationRoute.modality,
    };
  }
}

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import type { ILlmModalityRoute, ILlmSetup, IUserGroup, LlmModality } from '@shared-types';
import {
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

export interface SetupRouteResolution {
  route: ResolvedRoute;
  providerApiKey?: string;
  userGroupId: string;
  llmSetupId: string;
  modality: LlmModality;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseModalityRoute(value: unknown): ILlmModalityRoute | null {
  if (!isRecord(value)) {
    return null;
  }

  const connectionId =
    typeof value.connectionId === 'string' ? value.connectionId.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!connectionId || !model) {
    return null;
  }

  return { connectionId, model };
}

function parseLlmSetup(id: string, data: FirebaseFirestore.DocumentData): ILlmSetup | null {
  if (!isRecord(data.routes)) {
    return null;
  }

  const text = parseModalityRoute(data.routes.text);
  const vision = parseModalityRoute(data.routes.vision);
  const image = parseModalityRoute(data.routes.image);

  if (!text || !vision || !image) {
    return null;
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    return null;
  }

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    routes: { text, vision, image },
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

  static async resolveModalityRoute(
    userId: string,
    modality: LlmModality
  ): Promise<SetupRouteResolution> {
    const context = await this.resolveUserRoutingContext(userId);
    const modalityRoute = context.setup.routes[modality];

    functions.logger.info('Resolving LLM setup route', {
      userId,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      modality,
      connectionId: modalityRoute.connectionId,
      model: modalityRoute.model,
    });

    const resolution = await resolveProviderConnectionRoute({
      connectionId: modalityRoute.connectionId,
      model: modalityRoute.model,
      modality,
      userId: context.userId,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
    });

    return {
      route: resolution.route,
      providerApiKey: resolution.providerApiKey,
      userGroupId: context.userGroupId,
      llmSetupId: context.setup.id,
      modality,
    };
  }
}

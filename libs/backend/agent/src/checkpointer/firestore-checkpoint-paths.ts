import { FirestorePaths } from '@study-forge/backend-core/lib/firestore-paths';

export function buildAgentTurnKey(
  studyForgeThreadId: string,
  turnId: string,
): string {
  return `${studyForgeThreadId}:${turnId}`;
}

export function agentCheckpointCollection(userId: string, turnKey: string) {
  return FirestorePaths.agentCheckpointDocs(userId, turnKey);
}

export function agentCheckpointChannelValuesCollection(
  userId: string,
  turnKey: string,
) {
  return FirestorePaths.agentCheckpointChannelValues(userId, turnKey);
}

export function agentCheckpointTurnRef(userId: string, turnKey: string) {
  return FirestorePaths.agentCheckpointTurn(userId, turnKey);
}

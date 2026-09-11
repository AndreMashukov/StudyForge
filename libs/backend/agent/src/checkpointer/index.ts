import { FirestoreCheckpointSaver } from './firestore-checkpoint-saver';

let sharedCheckpointer: FirestoreCheckpointSaver | null = null;

export {
  FirestoreCheckpointSaver,
  deleteAgentTurnCheckpoints,
  claimAgentTurnCompletion,
  CheckpointOverflowUnavailableError,
  CheckpointSerializationTooLargeError,
  applyOverflowChannelValues,
} from './firestore-checkpoint-saver';
export type { IAgentTurnCompletion } from './firestore-checkpoint-saver';
export {
  buildAgentTurnKey,
  agentCheckpointCollection,
} from './firestore-checkpoint-paths';

export function getFirestoreCheckpointer(): FirestoreCheckpointSaver {
  if (!sharedCheckpointer) {
    sharedCheckpointer = new FirestoreCheckpointSaver();
  }
  return sharedCheckpointer;
}

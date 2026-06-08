import {
  SubjectWorldDialogueNode,
  SubjectWorldNpc,
  SubjectWorldProgressSnapshot,
} from '@shared-types';

function nodeMatchesProgress(
  node: SubjectWorldDialogueNode,
  progress: SubjectWorldProgressSnapshot
): boolean {
  const req = node.requiresProgress;
  if (!req) {
    return true;
  }

  if (
    typeof req.minVisitedPois === 'number' &&
    progress.visitedPoiIds.length < req.minVisitedPois
  ) {
    return false;
  }

  if (
    req.unlockedGateIds?.length &&
    !req.unlockedGateIds.every((id) => progress.unlockedGateIds.includes(id))
  ) {
    return false;
  }

  if (
    req.completedQuestIds?.length &&
    !req.completedQuestIds.every((id) => progress.completedQuestIds.includes(id))
  ) {
    return false;
  }

  return true;
}

function dialoguePriority(node: SubjectWorldDialogueNode): number {
  const req = node.requiresProgress;
  if (!req) return 0;
  if (req.completedQuestIds?.length) return 4;
  if (req.unlockedGateIds?.length) return 3;
  if (req.minVisitedPois) return 2;
  return 1;
}

export function selectBestDialogueNode(
  npc: SubjectWorldNpc,
  progress: SubjectWorldProgressSnapshot
): SubjectWorldDialogueNode {
  const withRequirements = npc.dialogue.filter((node) => node.requiresProgress);
  const sorted = [...withRequirements].sort(
    (a, b) => dialoguePriority(b) - dialoguePriority(a)
  );

  for (const node of sorted) {
    if (nodeMatchesProgress(node, progress)) {
      return node;
    }
  }

  const intro =
    npc.dialogue.find((node) => !node.requiresProgress) ?? npc.dialogue[0];
  return intro;
}

export function findDialogueNodeById(
  npc: SubjectWorldNpc,
  nodeId: string
): SubjectWorldDialogueNode | null {
  return npc.dialogue.find((node) => node.id === nodeId) ?? null;
}

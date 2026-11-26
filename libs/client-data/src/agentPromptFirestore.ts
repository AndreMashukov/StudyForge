import { getDocs, limit, query, where } from 'firebase/firestore';
import {
  AGENT_PROMPT_APPLICABILITY,
  type IAgentPromptOwnRule,
} from '@shared-types';
import { userCollection } from './firestorePaths';

/** Matches the rules collection's bounded-list security rule. */
const AGENT_PROMPT_LIST_LIMIT = 100;

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/** The learner's agent prompts (rules that apply to `agent`, ADR 017) for the "/" menu. */
export async function listAgentPromptRulesFromFirestore(
  userId: string,
): Promise<IAgentPromptOwnRule[]> {
  const snapshot = await getDocs(
    query(
      userCollection(userId, 'rules'),
      where('applicableTo', 'array-contains', AGENT_PROMPT_APPLICABILITY),
      limit(AGENT_PROMPT_LIST_LIMIT),
    ),
  );
  const rules: IAgentPromptOwnRule[] = [];
  for (const document of snapshot.docs) {
    const data = document.data();
    const name = optionalText(data.name);
    if (!name) continue;
    const description = optionalText(data.description);
    const sourceBlueprintId = optionalText(data.sourceBlueprintId);
    rules.push({
      id: document.id,
      name,
      applicableTo: [AGENT_PROMPT_APPLICABILITY],
      ...(description ? { description } : {}),
      ...(sourceBlueprintId ? { sourceBlueprintId } : {}),
    });
  }
  return rules;
}

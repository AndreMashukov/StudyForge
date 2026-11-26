import { HttpsError } from 'firebase-functions/v2/https';
import {
  AGENT_PROMPT_CONTENT_MAX,
  AGENT_PROMPT_NOT_FOUND_CODE,
  AGENT_PROMPT_NOT_FOUND_MESSAGE,
  isAgentPromptApplicability,
  type AgentPromptRef,
  type AgentPromptRun,
} from '@shared-types';
import { getRule } from '@study-forge/backend-directories/rule-crud';
import { getPublishedAgentBlueprint } from '@study-forge/backend-directories/rule-blueprints';

const NAME_MAX = 200;

/**
 * Loads the current text of the agent prompt a learner picked in the "/" menu
 * (ADR 017): their own agent rule, or a published agent blueprint (suggested
 * agent prompt). Throws not-found when it was deleted or unpublished.
 */
export async function loadAgentPromptRun(
  userId: string,
  ref: AgentPromptRef,
): Promise<AgentPromptRun> {
  const prompt =
    ref.source === 'rule'
      ? await getRule(userId, ref.id)
      : await getPublishedAgentBlueprint(ref.id);
  const name = typeof prompt?.name === 'string' ? prompt.name.trim() : '';
  const content =
    typeof prompt?.content === 'string' ? prompt.content.trim() : '';
  if (
    !prompt ||
    !name ||
    !content ||
    !isAgentPromptApplicability(prompt.applicableTo)
  ) {
    throw new HttpsError('not-found', AGENT_PROMPT_NOT_FOUND_MESSAGE, {
      code: AGENT_PROMPT_NOT_FOUND_CODE,
    });
  }
  return {
    source: ref.source,
    id: ref.id,
    name: name.slice(0, NAME_MAX),
    content: content.slice(0, AGENT_PROMPT_CONTENT_MAX),
  };
}

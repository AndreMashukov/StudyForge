import type { AgentReferencedItemType } from '@shared-types';
import { agentReferencedItemTypeSchema } from '@shared-types';

export function isAgentReferencedItemType(
  value: string,
): value is AgentReferencedItemType {
  return agentReferencedItemTypeSchema.safeParse(value).success;
}

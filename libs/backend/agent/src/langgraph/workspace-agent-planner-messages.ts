export interface IPlannerChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const PLANNER_JSON_RETRY_INSTRUCTION =
  'Your previous output was invalid JSON. Return ONLY valid JSON matching the required schema. If no tools are needed, use {"type":"response","response":"..."} with the user-facing reply. Keep the original objective.';

export function buildWorkspacePlannerMessages(input: {
  instruction: string;
  userMessage: string;
  previousInvalidContent?: string;
}): IPlannerChatMessage[] {
  const messages: IPlannerChatMessage[] = [
    { role: 'system', content: input.instruction },
    { role: 'user', content: input.userMessage },
  ];
  if (input.previousInvalidContent) {
    messages.push({
      role: 'assistant',
      content: input.previousInvalidContent,
    });
    messages.push({
      role: 'user',
      content: PLANNER_JSON_RETRY_INSTRUCTION,
    });
  }
  return messages;
}

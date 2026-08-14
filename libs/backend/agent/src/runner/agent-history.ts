export interface AgentHistoryAction {
  kind: string;
  summary: string;
  entityId?: string;
  jobId?: string;
}

export function withExecutedActionContext(
  content: string,
  actions?: AgentHistoryAction[],
): string {
  if (!actions || actions.length === 0) {
    return content;
  }

  const lines = actions.map((action) => {
    const parts = [action.kind];
    if (action.entityId) {
      parts.push(`id=${action.entityId}`);
    }
    if (action.jobId) {
      parts.push(`jobId=${action.jobId}`);
    }
    parts.push(action.summary);
    return `- ${parts.join(' ')}`;
  });

  return `${content}\n\n[Executed actions]\n${lines.join('\n')}`;
}

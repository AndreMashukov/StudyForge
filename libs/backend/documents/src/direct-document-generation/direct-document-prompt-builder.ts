import { buildHtmlDocumentPrompt } from '@shared-types';
import type { DocumentAgentContext } from '../document-agent/document-agent-runner';

export function buildDirectHtmlPrompt(agentContext: DocumentAgentContext): string {
  const base = buildHtmlDocumentPrompt(
    agentContext.userPrompt,
    agentContext.rulesText || undefined
  );

  if (!agentContext.files?.length) {
    return base;
  }

  const references = agentContext.files
    .map(
      (file, index) => `### Reference ${index + 1}: ${file.filename}
${file.content}`
    )
    .join('\n\n');

  return `${base}

=== REFERENCE DOCUMENTS ===
${references}

Synthesize the reference material into a polished HTML fragment.`;
}

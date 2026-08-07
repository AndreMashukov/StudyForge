import { buildHtmlDocumentPrompt, buildSealedHtmlOutputContract } from '@shared-types';
import type { GenerationKind } from '@shared-types';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html|json|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export async function repairDirectDocumentHtml(params: {
  userId: string;
  generationKind: Extract<GenerationKind, 'documentFromPrompt' | 'documentFromScreenshot'>;
  userPrompt: string;
  rulesText: string;
  htmlFragment: string;
  validationErrors: string;
  screenshotContext?: string;
}): Promise<string> {
  const sourceSection = params.screenshotContext
    ? `\nScreenshot context (metadata only, image not included):\n${params.screenshotContext}`
    : '';

  const prompt = `${buildHtmlDocumentPrompt(params.userPrompt, params.rulesText || undefined)}${sourceSection}

The previous HTML fragment failed validation:
${params.validationErrors}

Previous fragment:
${params.htmlFragment}

Repair the fragment so it satisfies every validation rule and the sealed output contract:
${buildSealedHtmlOutputContract()}`;

  const raw = await LlmGenerationService.generateText(
    params.userId,
    params.generationKind,
    prompt,
    {
      logLabel: `direct-document-${params.generationKind}-repair`,
      successLogMessage: 'Direct-with-repair HTML fragment repaired',
      temperature: 0.4,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 16384,
      disableReasoning: true,
    }
  );

  return stripCodeFences(raw);
}

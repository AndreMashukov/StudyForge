import { logger } from 'firebase-functions/v2';
import { z } from 'zod';
import type { IFileContent, IArtifactAgentDiagnostics } from '@shared-types';
import { buildHtmlDocumentPrompt, buildSealedHtmlOutputContract } from '@shared-types';
import { LlmGenerationService } from '@study-forge/backend-llm/llm';
import { resolveTextRoute } from '@study-forge/backend-llm/llm/llm-text-runner';
import { recordModelUsage } from '@study-forge/backend-artifacts/artifact-agent/artifact-agent-definition';
import type { DocumentRule } from '../document-html/types';
import { formatValidationFindings } from '../document-html/types';

const criticResponseSchema = z.object({
  passed: z.boolean(),
  findings: z.array(
    z.object({
      ruleName: z.string(),
      satisfied: z.boolean(),
      severity: z.enum(['error', 'warning']).default('error'),
      message: z.string(),
      evidence: z.string().optional(),
      repairHint: z.string().optional(),
    })
  ),
});

export interface DocumentPlan {
  outline: string[];
  ruleChecklist: string[];
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html|json|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function formatRulesForPrompt(rules: DocumentRule[]): string {
  if (rules.length === 0) {
    return '';
  }
  return rules.map((rule, index) => `RULE ${index + 1}: ${rule.name}\n${rule.content}`).join('\n\n');
}

function buildContextPrompt(userPrompt: string, files: IFileContent[] | undefined, rulesText: string): string {
  const base = buildHtmlDocumentPrompt(userPrompt, rulesText || undefined);
  if (!files?.length) {
    return base;
  }

  const references = files
    .map(
      (file, index) => `### Reference ${index + 1}: ${file.filename}
${file.content}`
    )
    .join('\n\n');

  return `${base}

=== REFERENCE DOCUMENTS ===
${references}

Synthesize the reference material into a polished learning document.`;
}

async function generateText(
  userId: string,
  capability: 'documentFromPrompt' | 'documentFromScreenshot' | 'sourceDocumentEnhancement',
  prompt: string,
  diagnostics: IArtifactAgentDiagnostics,
  role: 'generator' | 'repair' | 'critic' | 'refiner'
): Promise<string> {
  const route = await resolveTextRoute(userId, capability, `document-agent-${role}`);
  const startMs = Date.now();

  const text = await LlmGenerationService.generateText(userId, capability, prompt, {
    logLabel: `document-agent-${role}`,
    successLogMessage: 'Document agent text generated',
    temperature: 0.4,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 16384,
  });

  recordModelUsage(diagnostics, {
    role,
    capability,
    model: route.resolution.route.model,
    durationMs: Date.now() - startMs,
  });

  return stripCodeFences(text);
}

export async function planDocumentHtml(
  userId: string,
  userPrompt: string,
  rules: DocumentRule[],
  diagnostics: IArtifactAgentDiagnostics
): Promise<DocumentPlan> {
  const prompt = `Create a JSON outline for an educational HTML document.

User request:
${userPrompt}

Rules:
${formatRulesForPrompt(rules) || '(none)'}

Return ONLY valid JSON:
{
  "outline": ["Section 1", "Section 2"],
  "ruleChecklist": ["Requirement 1", "Requirement 2"]
}`;

  const raw = await generateText(userId, 'documentFromPrompt', prompt, diagnostics, 'generator');
  try {
    const parsed = JSON.parse(raw) as DocumentPlan;
    if (Array.isArray(parsed.outline)) {
      return parsed;
    }
  } catch (error) {
    logger.warn('Document plan JSON parse failed; using fallback outline', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    outline: ['Introduction', 'Core Concepts', 'Examples', 'Summary', 'Glossary'],
    ruleChecklist: rules.map((rule) => rule.name),
  };
}

export async function draftDocumentHtml(
  userId: string,
  userPrompt: string,
  rulesText: string,
  files: IFileContent[] | undefined,
  plan: DocumentPlan | undefined,
  diagnostics: IArtifactAgentDiagnostics
): Promise<string> {
  const planSection = plan
    ? `\n\nDocument plan:\nOutline: ${plan.outline.join(' > ')}\nRule checklist: ${plan.ruleChecklist.join('; ')}`
    : '';

  const prompt = `${buildContextPrompt(userPrompt, files, rulesText)}${planSection}

Generate the complete HTML fragment now.`;
  diagnostics.generatorAttempts += 1;
  return generateText(userId, 'documentFromPrompt', prompt, diagnostics, 'generator');
}

export async function repairDocumentHtml(
  userId: string,
  userPrompt: string,
  rulesText: string,
  htmlFragment: string,
  validationErrors: string,
  plan: DocumentPlan | undefined,
  diagnostics: IArtifactAgentDiagnostics
): Promise<string> {
  diagnostics.repairCount += 1;
  const planSection = plan ? `\nPlan outline: ${plan.outline.join(' > ')}` : '';
  const prompt = `${buildHtmlDocumentPrompt(userPrompt, rulesText || undefined)}

The previous HTML fragment failed validation:
${validationErrors}

Previous fragment:
${htmlFragment}
${planSection}

Repair the fragment so it satisfies every validation rule and the sealed output contract:
${buildSealedHtmlOutputContract()}`;

  return generateText(userId, 'documentFromPrompt', prompt, diagnostics, 'repair');
}

export async function critiqueRulesAdherence(
  userId: string,
  userPrompt: string,
  rules: DocumentRule[],
  htmlFragment: string,
  diagnostics: IArtifactAgentDiagnostics
): Promise<{ passed: boolean; findings: string }> {
  if (rules.length === 0) {
    return { passed: true, findings: '' };
  }

  diagnostics.criticCycles += 1;
  const prompt = `You are a strict document rules critic. Evaluate whether the HTML fragment satisfies EVERY selected rule.

PLATFORM CONTRACT (overrides conflicting rule text):
- The output is an HTML fragment only. Do NOT require <html>, <head>, or <body>.
- Do NOT require CDN <script>/<link>/<style> tags.
- Script/style/link tags are forbidden.
- Do NOT require Mermaid, Plotly, or LaTeX unless a selected rule explicitly asks for them.
- When selected rules prescribe incompatible document structures or length targets, prefer the most specific domain/format rule that matches the user request (for example Linear Algebra Learning Document Format over generic Doc HTML Format section names/length, and over Brief How-To Format for explanatory learning docs). Still enforce compatible HTML purity constraints from Doc HTML Format (fragment-only, no conversational filler).

User request:
${userPrompt}

Selected rules:
${formatRulesForPrompt(rules)}

HTML fragment:
${htmlFragment}

Instructions:
- Judge semantic adherence, not just keyword presence.
- Examples of failures: missing Mermaid/Plotly/LaTeX when a selected rule clearly requires them, adding Mermaid/Plotly/LaTeX when no selected rule asks for them, wrong tone, missing required sections/topics for the winning structure rule, using forbidden phrasing/style, ignoring formatting instructions in the rules.
- Do NOT fail Web Math Formula Rendering merely because KaTeX/MathJax CDN tags are absent when LaTeX delimiters are present.
- Do NOT fail Web Graph Rendering merely because Plotly CDN tags are absent when a language-plotly block is present.
- Short pedagogical framing in learning docs is allowed (for example a one-sentence purpose statement). Only fail Doc HTML Format for clear non-document chatter such as "Sure, here is your document" or assistant meta-commentary about the generation process.
- If a rule is satisfied, mark satisfied=true.
- If a rule is violated, mark satisfied=false with a concrete message and repairHint.
- Use severity "error" for hard requirements; "warning" only for soft preferences.

Return ONLY valid JSON:
{
  "passed": true,
  "findings": [
    {
      "ruleName": "Rule name",
      "satisfied": true,
      "severity": "error",
      "message": "Why this rule passed or failed",
      "repairHint": "Optional fix"
    }
  ]
}`;

  const raw = await generateText(userId, 'documentFromPrompt', prompt, diagnostics, 'critic');
  try {
    const parsed = criticResponseSchema.parse(JSON.parse(raw));
    const failed = parsed.findings.filter((finding) => !finding.satisfied && finding.severity === 'error');
    if (parsed.passed || failed.length === 0) {
      return { passed: true, findings: '' };
    }
    return {
      passed: false,
      findings: failed
        .map(
          (finding) =>
            `[${finding.ruleName}] ${finding.message}${finding.repairHint ? ` Hint: ${finding.repairHint}` : ''}`
        )
        .join('\n'),
    };
  } catch (error) {
    logger.warn('Rules critic JSON parse failed; treating as pass', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { passed: true, findings: '' };
  }
}

export async function refineDocumentHtml(
  userId: string,
  userPrompt: string,
  rulesText: string,
  htmlFragment: string,
  criticFindings: string,
  diagnostics: IArtifactAgentDiagnostics
): Promise<string> {
  const prompt = `${buildHtmlDocumentPrompt(userPrompt, rulesText || undefined)}

The rules critic reported these issues:
${criticFindings}

Current HTML fragment:
${htmlFragment}

Revise the fragment to address every critic issue while preserving valid content.
${buildSealedHtmlOutputContract()}`;

  return generateText(userId, 'documentFromPrompt', prompt, diagnostics, 'refiner');
}

export function formatValidationErrorsForRepair(findings: Parameters<typeof formatValidationFindings>[0]): string {
  return formatValidationFindings(findings);
}

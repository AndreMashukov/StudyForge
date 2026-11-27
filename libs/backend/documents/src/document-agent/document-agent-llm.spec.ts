import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IArtifactAgentDiagnostics } from '@shared-types';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@study-forge/backend-llm/llm', () => ({
  LlmGenerationService: { generateText: generateTextMock },
}));

vi.mock('@study-forge/backend-llm/llm/llm-text-runner', () => ({
  resolveTextRoute: vi.fn().mockResolvedValue({
    resolution: { route: { model: 'MiniMax-M3' } },
    usesExternalProvider: true,
  }),
}));

vi.mock('@study-forge/backend-artifacts/artifact-definition', () => ({
  recordModelUsage: vi.fn(),
}));

import {
  critiqueRulesAdherence,
  draftDocumentHtml,
  refineDocumentHtml,
} from './document-agent-llm';

function emptyDiagnostics(): IArtifactAgentDiagnostics {
  return {
    artifactKind: 'documentFromPrompt',
    agentDefinitionVersion: 'document-html-v1',
    generatorAttempts: 1,
    repairCount: 0,
    criticCycles: 0,
    modelUsage: [],
    residuals: [],
  };
}

const rules = [{ name: 'Doc HTML Format', content: 'Use semantic HTML.' }];
const fragment = '<h1>Quiz recap</h1><p>Body</p>';
const emptyResponse = new Error(
  'Empty response from MiniMax API (finish_reason=length, max_tokens=8192)',
);

describe('document agent quality passes', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
  });

  it('critic: an LLM failure passes the fragment through with a warning residual', async () => {
    generateTextMock.mockRejectedValueOnce(emptyResponse);
    const diagnostics = emptyDiagnostics();

    const result = await critiqueRulesAdherence(
      'user-1',
      'Recap my quizzes',
      rules,
      fragment,
      diagnostics,
    );

    expect(result).toEqual({ passed: true, findings: '' });
    expect(diagnostics.criticCycles).toBe(1);
    expect(diagnostics.residuals).toEqual([
      {
        gateId: 'document-agent-critic',
        severity: 'warning',
        message: `critic step skipped: ${emptyResponse.message}`,
      },
    ]);
  });

  it('critic: still reports failed rules when the LLM answers', async () => {
    generateTextMock.mockResolvedValueOnce(
      JSON.stringify({
        passed: false,
        findings: [
          {
            ruleName: 'Doc HTML Format',
            satisfied: false,
            severity: 'error',
            message: 'Missing glossary',
            repairHint: 'Add a glossary',
          },
        ],
      }),
    );
    const diagnostics = emptyDiagnostics();

    const result = await critiqueRulesAdherence(
      'user-1',
      'Recap my quizzes',
      rules,
      fragment,
      diagnostics,
    );

    expect(result.passed).toBe(false);
    expect(result.findings).toContain('Missing glossary');
    expect(diagnostics.residuals).toEqual([]);
  });

  it('refiner: an LLM failure keeps the current fragment', async () => {
    generateTextMock.mockRejectedValueOnce(emptyResponse);
    const diagnostics = emptyDiagnostics();

    const result = await refineDocumentHtml(
      'user-1',
      'Recap my quizzes',
      'RULE 1: Doc HTML Format',
      fragment,
      '[Doc HTML Format] Missing glossary',
      diagnostics,
    );

    expect(result).toBe(fragment);
    expect(diagnostics.residuals).toMatchObject([
      { gateId: 'document-agent-refiner', severity: 'warning' },
    ]);
  });

  it('refiner: returns the refined fragment when the LLM answers', async () => {
    generateTextMock.mockResolvedValueOnce('```html\n<h1>Refined</h1>\n```');

    const result = await refineDocumentHtml(
      'user-1',
      'Recap my quizzes',
      '',
      fragment,
      'issue',
      emptyDiagnostics(),
    );

    expect(result).toBe('<h1>Refined</h1>');
  });

  it('runs the critic and refiner with reasoning disabled; the generator keeps its profile', async () => {
    generateTextMock.mockResolvedValue('{"passed":true,"findings":[]}');
    const diagnostics = emptyDiagnostics();

    await critiqueRulesAdherence('user-1', 'p', rules, fragment, diagnostics);
    await refineDocumentHtml('user-1', 'p', '', fragment, 'issue', diagnostics);
    await draftDocumentHtml(
      'user-1',
      'p',
      '',
      undefined,
      undefined,
      diagnostics,
    );

    const optionsByLabel = Object.fromEntries(
      generateTextMock.mock.calls.map((call) => [call[3].logLabel, call[3]]),
    );
    expect(optionsByLabel['document-agent-critic']).toMatchObject({
      profile: 'deterministicUtility',
      disableReasoning: true,
    });
    expect(optionsByLabel['document-agent-refiner']).toMatchObject({
      profile: 'deterministicUtility',
      disableReasoning: true,
    });
    expect(optionsByLabel['document-agent-generator'].profile).toBe(
      'structuredArtifact',
    );
    expect(optionsByLabel['document-agent-generator']).not.toHaveProperty(
      'disableReasoning',
    );
  });
});

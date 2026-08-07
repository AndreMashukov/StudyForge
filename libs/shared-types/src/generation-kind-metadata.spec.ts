import { describe, expect, it } from 'vitest';
import { isGenerationWorkflow, GENERATION_KIND_METADATA } from './generation-kind-metadata';

describe('generation workflow metadata', () => {
  it('accepts directWithRepair as a workflow', () => {
    expect(isGenerationWorkflow('directWithRepair')).toBe(true);
    expect(isGenerationWorkflow('direct')).toBe(true);
    expect(isGenerationWorkflow('agentic')).toBe(true);
    expect(isGenerationWorkflow('unknown')).toBe(false);
  });

  it('exposes directWithRepair only on document prompt and screenshot kinds', () => {
    expect(GENERATION_KIND_METADATA.documentFromPrompt.supportedWorkflows).toContain(
      'directWithRepair'
    );
    expect(GENERATION_KIND_METADATA.documentFromScreenshot.supportedWorkflows).toContain(
      'directWithRepair'
    );
    expect(GENERATION_KIND_METADATA.quiz.supportedWorkflows).not.toContain('directWithRepair');
  });

  it('does not define separate repair generation kinds', () => {
    expect('documentFromPromptRepair' in GENERATION_KIND_METADATA).toBe(false);
    expect('documentFromScreenshotRepair' in GENERATION_KIND_METADATA).toBe(false);
  });
});

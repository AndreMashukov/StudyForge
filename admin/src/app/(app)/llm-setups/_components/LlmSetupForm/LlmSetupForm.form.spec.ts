import { describe, expect, it } from 'vitest';
import {
  formatWorkflowOptionLabel,
  getSupportedWorkflowOptions,
  getWorkflowHelpText,
} from './LlmSetupForm.form';

describe('workspace agent workflow labels', () => {
  it('exposes agentic workflow for directoryAgent', () => {
    expect(getSupportedWorkflowOptions('directoryAgent')).toEqual([
      'direct',
      'agentic',
    ]);
  });

  it('labels direct as ADK and agentic as Plan-Execute', () => {
    expect(formatWorkflowOptionLabel('directoryAgent', 'direct')).toBe('ADK');
    expect(formatWorkflowOptionLabel('directoryAgent', 'agentic')).toBe(
      'Plan-Execute',
    );
  });

  it('documents planner and executor routing', () => {
    expect(getWorkflowHelpText('directoryAgent')).toContain('directoryAgent');
    expect(getWorkflowHelpText('directoryAgent')).toContain('agentExecutor');
  });
});

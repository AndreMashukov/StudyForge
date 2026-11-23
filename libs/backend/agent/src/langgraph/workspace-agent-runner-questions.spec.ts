import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentQuestion } from '@shared-types';

const plannerMock = vi.hoisted(() => vi.fn());
const executorMock = vi.hoisted(() => vi.fn());

vi.mock('./workspace-agent-planner-llm', () => ({
  callWorkspacePlannerModel: plannerMock,
}));
vi.mock('./workspace-agent-executor-llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./workspace-agent-executor-llm')>()),
  runWorkspaceExecutorStep: executorMock,
}));
vi.mock(
  '@study-forge/backend-core/services/langsmith-tracing',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@study-forge/backend-core/services/langsmith-tracing')
    >()),
    buildLangGraphTraceConfig: () => ({}),
    flushLangSmithTraces: async () => undefined,
  }),
);

import { WorkspaceAgentRunner } from './workspace-agent-runner';

function run(onQuestions: (questions: AgentQuestion[]) => void) {
  return WorkspaceAgentRunner.run({
    userId: 'user-1',
    studyForgeThreadId: 'thread-1',
    turnId: `turn-${Math.random().toString(36).slice(2)}`,
    systemPrompt: 'system',
    objective: 'Make flashcards',
    history: [],
    tools: [],
    useMemoryCheckpointer: true,
    onQuestions,
  });
}

describe('WorkspaceAgentRunner clarifying questions', () => {
  beforeEach(() => {
    plannerMock.mockReset();
    executorMock.mockReset();
  });

  it('ends the turn with the lead-in reply and reports normalized questions', async () => {
    plannerMock.mockResolvedValue({
      output: {
        type: 'response',
        response: 'A quick question before I start.',
        questions: [
          {
            header: 'Folder',
            question: 'Which folder should the flashcards go in?',
            options: [
              { label: 'AWS', recommended: true },
              { label: 'GCP', recommended: true },
              'New folder',
            ],
          },
          { question: 'Dropped: one option only', options: ['Only'] },
        ],
      },
      streamedUserReply: '',
    });
    const onQuestions = vi.fn();

    const reply = await run(onQuestions);

    expect(reply).toBe('A quick question before I start.');
    expect(executorMock).not.toHaveBeenCalled();
    expect(plannerMock).toHaveBeenCalledTimes(1);
    expect(onQuestions).toHaveBeenCalledTimes(1);
    const [questions] = onQuestions.mock.calls[0] as [AgentQuestion[]];
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'q1',
      header: 'Folder',
      allowOther: true,
      options: [
        { label: 'AWS', recommended: true },
        { label: 'GCP' },
        { label: 'New folder' },
      ],
    });
  });

  it('does not report questions for a plain reply', async () => {
    plannerMock.mockResolvedValue({
      output: { type: 'response', response: 'Hello!' },
      streamedUserReply: '',
    });
    const onQuestions = vi.fn();

    await expect(run(onQuestions)).resolves.toBe('Hello!');
    expect(onQuestions).not.toHaveBeenCalled();
  });
});

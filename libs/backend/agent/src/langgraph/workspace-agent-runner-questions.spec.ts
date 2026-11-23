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

function run(
  onQuestions: (questions: AgentQuestion[]) => void,
  objective = 'Make flashcards',
) {
  return WorkspaceAgentRunner.run({
    userId: 'user-1',
    studyForgeThreadId: 'thread-1',
    turnId: `turn-${Math.random().toString(36).slice(2)}`,
    systemPrompt: 'system',
    objective,
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

  it('asks before creating when a create-document request is ambiguous', async () => {
    plannerMock.mockResolvedValue({
      output: {
        type: 'response',
        response: 'Before I write it, one question.',
        questions: [
          {
            question: 'Which topic should the document cover?',
            options: [
              { label: 'Photosynthesis', recommended: true },
              'Cell division',
            ],
          },
        ],
      },
      streamedUserReply: '',
    });
    const onQuestions = vi.fn();

    const reply = await run(
      onQuestions,
      'Create a new document for my biology folder',
    );

    expect(reply).toBe('Before I write it, one question.');
    expect(plannerMock).toHaveBeenCalledTimes(1);
    expect(executorMock).not.toHaveBeenCalled();
    const [questions] = onQuestions.mock.calls[0] as [AgentQuestion[]];
    expect(questions.map((question) => question.question)).toEqual([
      'Which topic should the document cover?',
    ]);
  });

  it('still forces create_document when a create request replies without questions', async () => {
    plannerMock.mockResolvedValueOnce({
      output: { type: 'response', response: 'Your document is ready.' },
      streamedUserReply: '',
    });
    plannerMock.mockResolvedValue({
      output: { type: 'response', response: 'Done.' },
      streamedUserReply: '',
    });
    executorMock.mockResolvedValue({ text: 'no tool ran', toolOutcomes: [] });
    const onQuestions = vi.fn();

    await run(onQuestions, 'Create a new document for my biology folder');

    expect(executorMock).toHaveBeenCalled();
    expect(onQuestions).not.toHaveBeenCalled();
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

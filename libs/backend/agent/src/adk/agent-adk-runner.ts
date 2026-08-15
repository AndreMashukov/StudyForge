import {
  InMemoryRunner,
  LlmAgent,
  StreamingMode,
  createEvent,
  getFunctionCalls,
  isFinalResponse,
  stringifyContent,
  type Event,
} from '@google/adk';
import type { AgentMessageStreamEvent, GenerationKind } from '@shared-types';
import { EMPTY_AGENT_REPLY } from '../runner/agent-chat-fallback';
import type { AgentToolDefinition } from '../tools/create-agent-tools';
import { agentToolsToFunctionTools } from './agent-adk-tools';
import { StudyForgeAdkLlm } from './studyforge-adk-llm';

const WORKSPACE_APP_NAME = 'study-forge-workspace-agent';
const DIRECTORY_APP_NAME = 'study-forge-directory-agent';
const MAX_LLM_CALLS = 16;

export interface AgentAdkRunnerInput {
  userId: string;
  threadId: string;
  systemPrompt: string;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools: AgentToolDefinition[];
  generationKind: Extract<GenerationKind, 'directoryAgent' | 'directoryChat'>;
  onEvent?: (event: AgentMessageStreamEvent) => void;
}

function appNameForKind(kind: AgentAdkRunnerInput['generationKind']): string {
  return kind === 'directoryChat' ? DIRECTORY_APP_NAME : WORKSPACE_APP_NAME;
}

function agentNameForKind(kind: AgentAdkRunnerInput['generationKind']): string {
  return kind === 'directoryChat' ? 'directoryAgent' : 'workspaceAgent';
}

function eventText(event: Event): string {
  const fromHelper = stringifyContent(event).trim();
  if (fromHelper.length > 0) {
    return fromHelper;
  }
  const parts = event.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

export class AgentAdkRunner {
  static async run(input: AgentAdkRunnerInput): Promise<string> {
    const appName = appNameForKind(input.generationKind);
    const agentName = agentNameForKind(input.generationKind);
    const agent = new LlmAgent({
      name: agentName,
      description:
        'StudyForge library assistant that inspects and manages directories, documents, rules, and artifacts.',
      model: new StudyForgeAdkLlm({
        userId: input.userId,
        generationKind: input.generationKind,
      }),
      instruction: input.systemPrompt,
      tools: agentToolsToFunctionTools(input.tools),
      includeContents: 'default',
      disallowTransferToParent: true,
      disallowTransferToPeers: true,
    });

    const runner = new InMemoryRunner({
      agent,
      appName,
    });

    const session = await runner.sessionService.createSession({
      appName,
      userId: input.userId,
      sessionId: input.threadId,
    });

    for (const message of input.history) {
      await runner.sessionService.appendEvent({
        session,
        event: createEvent({
          author: message.role === 'user' ? 'user' : agentName,
          content: {
            role: message.role === 'user' ? 'user' : 'model',
            parts: [{ text: message.content }],
          },
        }),
      });
    }

    input.onEvent?.({ type: 'status', message: 'Thinking...' });

    let reply = '';
    for await (const event of runner.runAsync({
      userId: input.userId,
      sessionId: input.threadId,
      newMessage: {
        role: 'user',
        parts: [{ text: input.userMessage }],
      },
      runConfig: {
        streamingMode: StreamingMode.NONE,
        maxLlmCalls: MAX_LLM_CALLS,
      },
    })) {
      const functionCalls = getFunctionCalls(event);
      if (functionCalls.length > 0) {
        const names = functionCalls
          .map((call) => call.name)
          .filter((name): name is string => Boolean(name));
        if (names.length > 0) {
          input.onEvent?.({
            type: 'status',
            message: `Running ${names.join(', ')}...`,
          });
        }
        continue;
      }

      if (isFinalResponse(event)) {
        const text = eventText(event);
        if (text.length > 0) {
          reply = text;
        }
      }
    }

    if (reply.length === 0) {
      reply = EMPTY_AGENT_REPLY;
    }

    return reply;
  }
}

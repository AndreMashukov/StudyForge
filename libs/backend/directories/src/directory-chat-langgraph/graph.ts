import { END, START, StateGraph } from '@langchain/langgraph';
import { DirectoryChatStateAnnotation } from './state';
import {
  DIRECTORY_CHAT_NODE_NAMES,
  routeAfterMaybeSummarize,
  routeAfterSummarize,
} from './routes';
import { respondNode } from './nodes/respond';
import { maybeSummarizeNode } from './nodes/maybe-summarize';
import { summarizeNode } from './nodes/summarize';
import { persistNode } from './nodes/persist';

export function buildDirectoryChatGraph() {
  return new StateGraph(DirectoryChatStateAnnotation)
    .addNode(DIRECTORY_CHAT_NODE_NAMES.respond, respondNode)
    .addNode(DIRECTORY_CHAT_NODE_NAMES.maybeSummarize, maybeSummarizeNode)
    .addNode(DIRECTORY_CHAT_NODE_NAMES.summarize, summarizeNode)
    .addNode(DIRECTORY_CHAT_NODE_NAMES.persist, persistNode)
    .addEdge(START, DIRECTORY_CHAT_NODE_NAMES.respond)
    .addEdge(DIRECTORY_CHAT_NODE_NAMES.respond, DIRECTORY_CHAT_NODE_NAMES.maybeSummarize)
    .addConditionalEdges(
      DIRECTORY_CHAT_NODE_NAMES.maybeSummarize,
      routeAfterMaybeSummarize,
      {
        [DIRECTORY_CHAT_NODE_NAMES.summarize]: DIRECTORY_CHAT_NODE_NAMES.summarize,
        [DIRECTORY_CHAT_NODE_NAMES.persist]: DIRECTORY_CHAT_NODE_NAMES.persist,
        [END]: END,
      }
    )
    .addConditionalEdges(
      DIRECTORY_CHAT_NODE_NAMES.summarize,
      routeAfterSummarize,
      {
        [DIRECTORY_CHAT_NODE_NAMES.persist]: DIRECTORY_CHAT_NODE_NAMES.persist,
        [END]: END,
      }
    )
    .addEdge(DIRECTORY_CHAT_NODE_NAMES.persist, END)
    .compile();
}

export const compiledDirectoryChatGraph = buildDirectoryChatGraph();

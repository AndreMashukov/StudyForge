import { END, START, StateGraph } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { WorkspaceAgentStateAnnotation } from './workspace-agent-state';
import { plannerNode } from './nodes/planner-node';
import { executorNode } from './nodes/executor-node';
import {
  routeAfterPlanner,
  WORKSPACE_AGENT_NODE_NAMES,
} from './route-after-planner';

export function buildWorkspaceAgentGraph(
  checkpointer?: BaseCheckpointSaver,
) {
  const graph = new StateGraph(WorkspaceAgentStateAnnotation)
    .addNode(WORKSPACE_AGENT_NODE_NAMES.planner, plannerNode)
    .addNode(WORKSPACE_AGENT_NODE_NAMES.executor, executorNode)
    .addEdge(START, WORKSPACE_AGENT_NODE_NAMES.planner)
    .addConditionalEdges(
      WORKSPACE_AGENT_NODE_NAMES.planner,
      routeAfterPlanner,
      {
        [WORKSPACE_AGENT_NODE_NAMES.executor]:
          WORKSPACE_AGENT_NODE_NAMES.executor,
        [WORKSPACE_AGENT_NODE_NAMES.planner]:
          WORKSPACE_AGENT_NODE_NAMES.planner,
        [END]: END,
      },
    )
    .addEdge(WORKSPACE_AGENT_NODE_NAMES.executor, WORKSPACE_AGENT_NODE_NAMES.planner);

  return checkpointer ? graph.compile({ checkpointer }) : graph.compile();
}

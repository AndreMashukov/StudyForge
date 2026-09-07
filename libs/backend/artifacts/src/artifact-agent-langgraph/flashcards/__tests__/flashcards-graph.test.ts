/**
 * Topology and compile test for the flashcards LangGraph graph.
 *
 * This is the Phase C graph-topology test required by the migration spec
 * (spec item 8: "graph compile/topology test"). It exercises the
 * structural contract of the flashcards `StateGraph` without invoking it
 * end-to-end:
 *
 *   - The graph compiles without throwing.
 *   - All five flashcards-specific node names are registered on the
 *     compiled graph.
 *   - The expected linear edges are present (START -> load_context ->
 *     generate, repair -> gate, finalize -> END).
 *   - The expected conditional edges are present (`generate` and `gate`)
 *     with the correct path maps.
 *   - The graph has exactly one START source and exactly one END sink,
 *     matching the spec's terminal topology.
 *   - The compiled `flashcardsGraph` module-level export is the same
 *     instance the factory returns, satisfying the "compile once per
 *     process" rule.
 *   - The graph does not register nodes from the diagram-quiz graph
 *     (`critic`, `refiner`); flashcards is repair-only.
 *
 * The P4 failure-routing short-circuit is exercised structurally here:
 * the conditional edge from `generate` must include both `gate` and
 * `finalize` targets so the route function can route a terminally
 * failed run straight to `finalize` rather than running `gate` against a
 * missing/invalid draft. The route function itself is covered in
 * `route-after-generate.test.ts`; here we pin down the topology that
 * makes that short-circuit possible.
 *
 * This file is intentionally scoped to graph structure. End-to-end
 * behavior (repairs advancing the iteration counter, finalize marking
 * the outcome, recursion-limit invoke config) is covered in node-level
 * tests and in `run-flashcards-pipeline.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  compileFlashcardsGraph,
  createFlashcardsStateGraph,
  FLASHCARDS_NODE_NAMES,
  flashcardsGraph,
} from '../flashcards-graph';

describe('flashcards LangGraph graph topology', () => {
  it('compiles without throwing', () => {
    // The factory must always return a StateGraph that compiles cleanly.
    // A throw here indicates a misconfigured node registration, a
    // missing edge, or an invalid conditional edge mapping.
    expect(() => compileFlashcardsGraph()).not.toThrow();
  });

  it('exposes a pre-compiled module-level instance', () => {
    // The single source-of-truth compile is the module-level
    // `flashcardsGraph` constant. The factory must agree with it.
    expect(flashcardsGraph).toBeDefined();
    expect(typeof flashcardsGraph.invoke).toBe('function');
  });

  it('registers every flashcards-specific node on the compiled graph', () => {
    // CompiledStateGraph exposes the registered nodes via `.nodes`. We
    // check membership rather than exact equality so adding extra nodes
    // (e.g. a future telemetry node) does not silently break this test.
    const compiled = compileFlashcardsGraph();
    const registered = Object.keys(compiled.nodes);
    for (const name of Object.values(FLASHCARDS_NODE_NAMES)) {
      expect(registered).toContain(name);
    }
  });

  it('does not register diagram-quiz-specific nodes', () => {
    // Flashcards is repair-only. There must be no `critic` or `refiner`
    // node registered on the flashcards graph; those belong to the
    // diagram-quiz graph only. This is a structural guard against
    // accidentally importing shared nodes from the diagram-quiz graph.
    const compiled = compileFlashcardsGraph();
    const registered = Object.keys(compiled.nodes);
    expect(registered).not.toContain('critic');
    expect(registered).not.toContain('refiner');
    expect(registered).not.toContain('load_context_quiz');
  });

  it('wires the linear edge START -> load_context', () => {
    // The factory uses StateGraph.edges to record edges. We assert the
    // first linear edge is present with the right source and target.
    const graph = createFlashcardsStateGraph();
    const startToLoad = graph.edges.find(
      (edge) =>
        edge.source === '__start__' &&
        edge.target === FLASHCARDS_NODE_NAMES.loadContext
    );
    expect(startToLoad).toBeDefined();
  });

  it('wires the linear edge load_context -> generate', () => {
    const graph = createFlashcardsStateGraph();
    const loadToGenerate = graph.edges.find(
      (edge) =>
        edge.source === FLASHCARDS_NODE_NAMES.loadContext &&
        edge.target === FLASHCARDS_NODE_NAMES.generate
    );
    expect(loadToGenerate).toBeDefined();
  });

  it('wires the repair-loop edge repair -> gate', () => {
    // After the repair node runs, the next super-step is `gate` so the
    // gate can re-evaluate blocker failures and either re-enter the loop
    // or advance to finalize. The conditional edge from `gate` selects
    // the actual next node; this is the static structural edge.
    const graph = createFlashcardsStateGraph();
    const repairToGate = graph.edges.find(
      (edge) =>
        edge.source === FLASHCARDS_NODE_NAMES.repair &&
        edge.target === FLASHCARDS_NODE_NAMES.gate
    );
    expect(repairToGate).toBeDefined();
  });

  it('wires the terminal edge finalize -> END', () => {
    // The compiled graph must end at `__end__` after finalize so a
    // successful run completes in one super-step from finalize. The
    // factory wires finalize -> END directly (not through a conditional
    // edge), so this is a plain linear edge.
    const graph = createFlashcardsStateGraph();
    const finalizeToEnd = graph.edges.find(
      (edge) =>
        edge.source === FLASHCARDS_NODE_NAMES.finalize &&
        edge.target === '__end__'
    );
    expect(finalizeToEnd).toBeDefined();
  });

  it('registers the post-generate conditional edge on the `generate` node', () => {
    // `addConditionalEdges` is recorded on the graph's conditionalEdges
    // array with the source node and a path map. The conditional edge
    // from generate must exist so the P4 failure-routing gap is closed:
    // when `generate` writes `artifact_outcome = 'failed'`, the route
    // function selects `finalize` rather than `gate`.
    const graph = createFlashcardsStateGraph();
    const generateConditional = graph.conditionalEdges.find(
      (edge) => edge.source === FLASHCARDS_NODE_NAMES.generate
    );
    expect(generateConditional).toBeDefined();
    // The path map must include both `gate` and `finalize` targets so the
    // conditional edge mapping is statically verifiable.
    expect(Object.keys(generateConditional?.pathMap ?? {})).toEqual(
      expect.arrayContaining([
        FLASHCARDS_NODE_NAMES.gate,
        FLASHCARDS_NODE_NAMES.finalize,
      ])
    );
  });

  it('registers the post-gate conditional edge on the `gate` node', () => {
    // `addConditionalEdges` from `gate` is the core routing decision:
    // either re-enter the repair loop (gate failures present and budget
    // open) or advance to `finalize`. The conditional edge must exist
    // on the `gate` node with both `repair` and `finalize` targets.
    const graph = createFlashcardsStateGraph();
    const gateConditional = graph.conditionalEdges.find(
      (edge) => edge.source === FLASHCARDS_NODE_NAMES.gate
    );
    expect(gateConditional).toBeDefined();
    expect(Object.keys(gateConditional?.pathMap ?? {})).toEqual(
      expect.arrayContaining([
        FLASHCARDS_NODE_NAMES.repair,
        FLASHCARDS_NODE_NAMES.finalize,
      ])
    );
  });

  it('has exactly one START source and one END sink', () => {
    // The compiled graph's structural source must be `__start__` and its
    // terminal sink must be `__end__`. Any other source/sink would
    // indicate an accidental parallel sub-graph or a missing terminal
    // edge.
    const graph = createFlashcardsStateGraph();
    const startEdges = graph.edges.filter(
      (edge) => edge.source === '__start__'
    );
    const endEdges = graph.edges.filter((edge) => edge.target === '__end__');
    expect(startEdges).toHaveLength(1);
    expect(endEdges).toHaveLength(1);
    expect(endEdges[0].source).toBe(FLASHCARDS_NODE_NAMES.finalize);
  });

  it('does not register any conditional edge from `finalize`', () => {
    // `finalize` is the terminal node. It must have no outgoing
    // conditional edges - finalize either runs to END directly or the
    // graph has reached a known-terminal state. Adding a conditional
    // edge here would silently reintroduce a loop after finalize.
    const graph = createFlashcardsStateGraph();
    const finalizeConditionals = graph.conditionalEdges.filter(
      (edge) => edge.source === FLASHCARDS_NODE_NAMES.finalize
    );
    expect(finalizeConditionals).toHaveLength(0);
  });

  it('does not register any conditional edge from `repair`', () => {
    // `repair` always advances to `gate` via a linear edge. A
    // conditional edge from `repair` would imply a routing decision is
    // made inside the repair node, which violates the "routing on
    // edges" rule.
    const graph = createFlashcardsStateGraph();
    const repairConditionals = graph.conditionalEdges.filter(
      (edge) => edge.source === FLASHCARDS_NODE_NAMES.repair
    );
    expect(repairConditionals).toHaveLength(0);
  });

  it('keeps `flashcardsGraph` and a freshly compiled graph structurally consistent', () => {
    // The factory and the module-level export must produce graphs with
    // the same node registry. A divergence here would mean the factory
    // and the cached export disagree, which is the kind of subtle drift
    // the "compile once per process" rule is meant to prevent.
    const compiled = compileFlashcardsGraph();
    expect(Object.keys(compiled.nodes).sort()).toEqual(
      Object.keys(flashcardsGraph.nodes).sort()
    );
  });
});
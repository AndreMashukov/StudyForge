import { describe, expect, it } from 'vitest';

import {
  FLASHCARDS_NODE_NAMES,
  createFlashcardsStateGraph,
  flashcardsGraph,
} from './flashcards-graph';
import { loadContextNode } from './nodes/load-context.node';
import { generateNode } from './nodes/generate.node';
import { gateNode } from './nodes/gate.node';
import { repairNode } from './nodes/repair.node';
import { finalizeNode } from './nodes/finalize.node';
import { loadContextNode as diagramLoadContextNode } from '../nodes/load-context.node';

describe('flashcards graph topology', () => {
  it('compiles without error', () => {
    expect(flashcardsGraph).toBeDefined();
    expect(createFlashcardsStateGraph().compile()).toBeDefined();
  });

  it('registers the expected node set without critic or refiner', () => {
    const nodeNames = Object.values(FLASHCARDS_NODE_NAMES);
    expect(nodeNames).toEqual([
      'load_context',
      'generate',
      'gate',
      'repair',
      'finalize',
    ]);
    expect(nodeNames).not.toContain('critic');
    expect(nodeNames).not.toContain('refiner');
  });

  it('uses flashcards-specific node modules, not diagram-quiz nodes', () => {
    expect(loadContextNode).not.toBe(diagramLoadContextNode);
    expect(typeof generateNode).toBe('function');
    expect(typeof gateNode).toBe('function');
    expect(typeof repairNode).toBe('function');
    expect(typeof finalizeNode).toBe('function');
  });
});

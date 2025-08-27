import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import type { ConsumerNode, ProducerNode } from '../types';
import { CONSTANTS } from '../constants';

const { VALUE_CHANGED } = CONSTANTS;

describe('Dependency Graph Cleanup Operations', () => {
  let graph: ReturnType<typeof createDependencyGraph>;

  beforeEach(() => {
    graph = createDependencyGraph();
  });

  const makeProducer = (): ProducerNode => ({
    __type: 'test',
    _out: undefined,
    _outTail: undefined,
    value: 0,
    _flags: 0
  });

  const makeConsumer = (): ConsumerNode => ({
    __type: 'test',
    _in: undefined,
    _flags: 0,
    _inTail: undefined
  });

  it('detaches all edges on dispose', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    graph.addEdge(a, target);
    graph.addEdge(b, target);
    graph.addEdge(c, target);

    graph.detachAll(target);

    expect(target._in).toBeUndefined();
    expect(a._out).toBeUndefined();
    expect(b._out).toBeUndefined();
    expect(c._out).toBeUndefined();
  });

  it('prunes only stale edges', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    // Initial run: link a, b, c
    graph.addEdge(a, target);
    graph.addEdge(b, target);
    graph.addEdge(c, target);

    // Simulate start of new run - reset tail
    target._inTail = undefined;
    
    // Next run: only access a and c (with NEW version like real usage)
    a._flags |= VALUE_CHANGED;
    graph.addEdge(a, target);
    c._flags |= VALUE_CHANGED;
    graph.addEdge(c, target);

    // Now prune stale (b should be removed)
    graph.pruneStale(target);

    // With tail-based pruning, only accessed edges remain
    let list = target._in;
    const active = new Set<unknown>();
    while (list) {
      active.add(list.from);
      list = list.nextIn;
    }
    expect(active.has(a)).toBe(true);
    expect(active.has(c)).toBe(true);
    expect(active.has(b)).toBe(false);
    // b's edge should be removed from producer's list
    expect(b._out).toBeUndefined();
  });

  it('removes all edges when none accessed in current run', () => {
    const a = makeProducer();
    const b = makeProducer();
    const target = makeConsumer();

    graph.addEdge(a, target);
    graph.addEdge(b, target);

    // Simulate start of new run - reset tail
    target._inTail = undefined;
    // Don't access any producer
    
    graph.pruneStale(target);

    // With tail-based pruning, all edges should be removed
    expect(target._in).toBeUndefined();
    // Edges removed from producer's lists
    expect(a._out).toBeUndefined();
    expect(b._out).toBeUndefined();
  });
});

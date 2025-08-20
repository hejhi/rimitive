import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import { createDependencySweeper } from './dependency-sweeper';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Dependency Sweeper', () => {
  let graph: ReturnType<typeof createDependencyGraph>;
  let sweeper: ReturnType<typeof createDependencySweeper>;

  beforeEach(() => {
    graph = createDependencyGraph();
    sweeper = createDependencySweeper(graph.unlink);
  });

  const makeProducer = (): ProducerNode => ({
    __type: 'test',
    _out: undefined,
    _dirty: false,
    _outTail: undefined
  });

  const makeConsumer = (): ConsumerNode => ({
    __type: 'test',
    _in: undefined,
    _flags: 0,
    _updateValue: () => true,
    _inTail: undefined
  });

  it('detaches all edges on dispose', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    graph.link(a, target, 1);
    graph.link(b, target, 1);
    graph.link(c, target, 1);

    sweeper.detachAll(target);

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
    graph.link(a, target, 1);
    graph.link(b, target, 1);
    graph.link(c, target, 1);

    // Simulate start of new run - reset tail
    target._inTail = undefined;
    
    // Next run: only access a and c
    a._dirty = true;
    graph.link(a, target, 1);
    c._dirty = true;
    graph.link(c, target, 1);

    // Now prune stale (b should be removed)
    sweeper.pruneStale(target);

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

    graph.link(a, target, 1);
    graph.link(b, target, 1);

    // Simulate start of new run - reset tail
    target._inTail = undefined;
    // Don't access any producer
    
    sweeper.pruneStale(target);

    // With tail-based pruning, all edges should be removed
    expect(target._in).toBeUndefined();
    // Edges removed from producer's lists
    expect(a._out).toBeUndefined();
    expect(b._out).toBeUndefined();
  });
});

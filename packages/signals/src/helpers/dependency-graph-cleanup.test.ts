import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGraphEdges } from './graph-edges';
import type { ConsumerNode, ProducerNode } from '../types';
import { CONSTANTS } from '../constants';

const { HAS_CHANGED } = CONSTANTS;

describe('Dependency Graph Cleanup Operations', () => {
  let graph: ReturnType<typeof createGraphEdges>;

  beforeEach(() => {
    graph = createGraphEdges();
  });

  const makeProducer = (): ProducerNode => ({
    __type: 'test',
    dependents: undefined,
    dependentsTail: undefined,
    value: 0,
    flags: 0
  });

  const makeConsumer = (): ConsumerNode => ({
    __type: 'test',
    dependencies: undefined,
    flags: 0,
    dependencyTail: undefined,
    notify: vi.fn(),
  });

  it('detaches all edges on dispose', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    graph.trackDependency(a, target, 0);
    graph.trackDependency(b, target, 0);
    graph.trackDependency(c, target, 0);

    graph.detachAll(target);

    expect(target.dependencies).toBeUndefined();
    expect(a.dependents).toBeUndefined();
    expect(b.dependents).toBeUndefined();
    expect(c.dependents).toBeUndefined();
  });

  it('prunes only stale edges', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    // Initial run: link a, b, c with version 1
    graph.trackDependency(a, target, 1);
    graph.trackDependency(b, target, 1);
    graph.trackDependency(c, target, 1);

    // Simulate start of new run - reset tail
    target.dependencyTail = undefined;
    
    // Next run: only access a and c with version 2 (b stays at version 1)
    a.flags |= HAS_CHANGED;
    graph.trackDependency(a, target, 2);
    c.flags |= HAS_CHANGED;
    graph.trackDependency(c, target, 2);

    // Now prune stale with current version 2 (b should be removed since it has version 1)
    graph.pruneStale(target);

    // With tail-based pruning, only accessed edges remain
    let list = target.dependencies;
    const active = new Set<unknown>();
    while (list) {
      active.add(list.producer);
      list = list.nextDependency;
    }
    expect(active.has(a)).toBe(true);
    expect(active.has(c)).toBe(true);
    expect(active.has(b)).toBe(false);
    // b's edge should be removed from producer's list
    expect(b.dependents).toBeUndefined();
  });

  it('removes all edges when none accessed in current run', () => {
    const a = makeProducer();
    const b = makeProducer();
    const target = makeConsumer();

    graph.trackDependency(a, target, 1);
    graph.trackDependency(b, target, 1);

    // Simulate start of new run - reset tail
    target.dependencyTail = undefined;
    // Don't access any producer (so all dependencies stay at version 1)
    
    // Prune with version 2 - all dependencies with version 1 should be removed
    graph.pruneStale(target);

    // With tail-based pruning, all edges should be removed
    expect(target.dependencies).toBeUndefined();
    // Edges removed from producer's lists
    expect(a.dependents).toBeUndefined();
    expect(b.dependents).toBeUndefined();
  });
});

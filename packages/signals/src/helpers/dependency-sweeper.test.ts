import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph, TrackedProducer } from './dependency-graph';
import { createDependencySweeper } from './dependency-sweeper';
import type { ConsumerNode } from '../types';

describe('Dependency Sweeper', () => {
  let graph: ReturnType<typeof createDependencyGraph>;
  let sweeper: ReturnType<typeof createDependencySweeper>;

  beforeEach(() => {
    graph = createDependencyGraph();
    sweeper = createDependencySweeper(graph.unlinkFromProducer);
  });

  const makeProducer = (version = 1): TrackedProducer => ({
    __type: 'test',
    _targets: undefined,
    _lastEdge: undefined,
    _version: version,
  });

  const makeConsumer = (): ConsumerNode => ({
    __type: 'test',
    _sources: undefined,
    _flags: 0,
    _invalidate: () => {},
    _refresh: () => true,
    _gen: 0,
  });

  it('detaches all edges on dispose', () => {
    const a = makeProducer();
    const b = makeProducer();
    const c = makeProducer();
    const target = makeConsumer();

    graph.ensureLink(a, target, a._version);
    graph.ensureLink(b, target, b._version);
    graph.ensureLink(c, target, c._version);

    sweeper.detachAll(target);

    expect(target._sources).toBeUndefined();
    expect(a._targets).toBeUndefined();
    expect(b._targets).toBeUndefined();
    expect(c._targets).toBeUndefined();
  });

  it('prunes only stale edges', () => {
    const a = makeProducer(1);
    const b = makeProducer(1);
    const c = makeProducer(1);
    const target = makeConsumer();

    // Initial run (gen 0): link a, b, c
    graph.ensureLink(a, target, a._version);
    graph.ensureLink(b, target, b._version);
    graph.ensureLink(c, target, c._version);

    // Next run (gen 1): only access a and c
    target._gen = 1;
    // Access a via cached fast path
    a._version = 2;
    graph.ensureLink(a, target, a._version);
    // Access c via cached fast path
    c._version = 2;
    graph.ensureLink(c, target, c._version);

    // Now prune stale (b)
    sweeper.pruneStale(target);

    // Expect only a and c remain as sources (order not guaranteed)
    let list = target._sources;
    const kept = new Set<any>();
    while (list) {
      kept.add(list.source);
      // also ensure gen matches current run
      expect(list.gen).toBe(1);
      list = list.nextSource;
    }
    expect(kept.has(a)).toBe(true);
    expect(kept.has(c)).toBe(true);
    expect(kept.has(b)).toBe(false);
    // b should be unlinked from its producer side
    expect(b._targets).toBeUndefined();
  });

  it('prunes all when none accessed in current run', () => {
    const a = makeProducer(1);
    const b = makeProducer(1);
    const target = makeConsumer();

    graph.ensureLink(a, target, a._version);
    graph.ensureLink(b, target, b._version);

    target._gen = 2; // new run, but we do not access any producer
    sweeper.pruneStale(target);

    expect(target._sources).toBeUndefined();
    expect(a._targets).toBeUndefined();
    expect(b._targets).toBeUndefined();
  });
});

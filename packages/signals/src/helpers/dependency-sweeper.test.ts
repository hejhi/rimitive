import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import { createDependencySweeper } from './dependency-sweeper';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Dependency Sweeper', () => {
  let graph: ReturnType<typeof createDependencyGraph>;
  let sweeper: ReturnType<typeof createDependencySweeper>;

  beforeEach(() => {
    graph = createDependencyGraph();
    sweeper = createDependencySweeper(graph.unlinkFromProducer);
  });

  const makeProducer = (version = 1): ProducerNode => ({
    __type: 'test',
    _targets: undefined,
    _version: version,
  });

  const makeConsumer = (): ConsumerNode => ({
    __type: 'test',
    _sources: undefined,
    _flags: 0,
    _invalidate: () => {},
    _onOutdated: () => true,
    _runVersion: 0,
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
    target._runVersion = 1;
    // Access a via cached fast path
    a._version = 2;
    graph.ensureLink(a, target, a._version);
    // Access c via cached fast path
    c._version = 2;
    graph.ensureLink(c, target, c._version);

    // Now prune stale (b)
    sweeper.pruneStale(target);

    // With edge recycling, all edges remain but b is marked as recyclable
    let list = target._sources;
    const active = new Set<unknown>();
    const recycled = new Set<unknown>();
    while (list) {
      if (list.version === -1) {
        recycled.add(list.source);
      } else {
        active.add(list.source);
        // Active edges should have current gen
        expect(list.gen).toBe(1);
      }
      list = list.nextSource;
    }
    expect(active.has(a)).toBe(true);
    expect(active.has(c)).toBe(true);
    expect(recycled.has(b)).toBe(true);
    // With recycling, b's edge stays in producer's list
    expect(b._targets).toBeDefined();
  });

  it('marks all as recyclable when none accessed in current run', () => {
    const a = makeProducer(1);
    const b = makeProducer(1);
    const target = makeConsumer();

    graph.ensureLink(a, target, a._version);
    graph.ensureLink(b, target, b._version);

    target._runVersion = 2; // new run, but we do not access any producer
    sweeper.pruneStale(target);

    // With edge recycling, edges remain but are marked as recyclable
    let list = target._sources;
    let recycledCount = 0;
    while (list) {
      expect(list.version).toBe(-1); // All should be marked as recyclable
      recycledCount++;
      list = list.nextSource;
    }
    expect(recycledCount).toBe(2);
    // Edges stay in producer's list for recycling
    expect(a._targets).toBeDefined();
    expect(b._targets).toBeDefined();
  });
});

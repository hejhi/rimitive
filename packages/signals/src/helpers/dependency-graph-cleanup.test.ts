import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGraphEdges } from './graph-edges';
import { detachAll } from '../context';
import type { ConsumerNode, ProducerNode } from '../types';

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

    detachAll(target);

    expect(target.dependencies).toBeUndefined();
    expect(a.dependents).toBeUndefined();
    expect(b.dependents).toBeUndefined();
    expect(c.dependents).toBeUndefined();
  });
});

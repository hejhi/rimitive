import { describe, it, expect, vi } from 'vitest';
import { createGraphTraversal } from './graph-traversal';
import { CONSTANTS } from '../constants';
import type { ConsumerNode, Dependency, FromNode } from '../types';

const { STATUS_CLEAN, STATUS_PENDING } = CONSTANTS;

describe('GraphTraversal', () => {
  it('should provide a propagate function that marks nodes', () => {
    const traversal = createGraphTraversal();

    const node: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    const dependency: Dependency = {
      consumer: node,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    traversal.propagate(dependency);

    expect(node.status).toBe(STATUS_PENDING);
  });

  it('should call visitor for leaf nodes', () => {
    const traversal = createGraphTraversal();
    const visitor = vi.fn();

    const leafNode: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    const dependency: Dependency = {
      consumer: leafNode,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    traversal.traverseGraph(dependency, visitor);

    expect(visitor).toHaveBeenCalledWith(leafNode);
    expect(visitor).toHaveBeenCalledTimes(1);
  });

  it('should traverse through intermediate nodes', () => {
    const traversal = createGraphTraversal();
    const visitor = vi.fn();

    const leafNode: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    const leafDep: Dependency = {
      consumer: leafNode,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    const intermediateNode: ConsumerNode & { subscribers: Dependency; subscribersTail: Dependency } = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      subscribers: leafDep,
      subscribersTail: leafDep,
    };

    const rootDep: Dependency = {
      consumer: intermediateNode,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    traversal.traverseGraph(rootDep, visitor);

    // Should only visit leaf nodes
    expect(visitor).toHaveBeenCalledWith(leafNode);
    expect(visitor).toHaveBeenCalledTimes(1);

    // Both nodes should be marked
    expect(intermediateNode.status).toBe(STATUS_PENDING);
    expect(leafNode.status).toBe(STATUS_PENDING);
  });

  it('can be used to create a minimal context without scheduling', () => {
    // Example of how to compose a context with just propagation, no scheduling
    const traversal = createGraphTraversal();

    // This would be used in signal.ts instead of scheduler.propagate
    const minimalContext = {
      propagate: traversal.propagate,
      // No scheduler, no effects, no batching needed
    };

    expect(minimalContext.propagate).toBeDefined();
    expect(minimalContext).not.toHaveProperty('flush');
    expect(minimalContext).not.toHaveProperty('startBatch');
  });
});
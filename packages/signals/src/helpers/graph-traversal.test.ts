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

  it('should handle diamond dependencies with already-processed nodes', () => {
    const traversal = createGraphTraversal();
    const visitor = vi.fn();

    // Create diamond: A -> [B, C] -> D
    // This tests the backtracking when D is encountered twice
    const leafD: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    // D dependency from B
    const depBtoD: Dependency = {
      consumer: leafD,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // D dependency from C (same consumer, different dependency object)
    const depCtoD: Dependency = {
      consumer: leafD, // Same consumer as B->D
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // B node with D as subscriber
    const nodeB: ConsumerNode & { subscribers: Dependency } = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      subscribers: depBtoD,
    };

    // C node with D as subscriber
    const nodeC: ConsumerNode & { subscribers: Dependency } = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      subscribers: depCtoD,
    };

    // A->B dependency
    const depAtoB: Dependency = {
      consumer: nodeB,
      producer: {} as FromNode,
      nextConsumer: undefined, // Will link to C
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // A->C dependency (sibling to B)
    const depAtoC: Dependency = {
      consumer: nodeC,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // Link B and C as siblings
    depAtoB.nextConsumer = depAtoC;

    // Start traversal from A's subscribers (B and C)
    traversal.traverseGraph(depAtoB, visitor);

    // Should visit D only once (even though reached via B and C)
    expect(visitor).toHaveBeenCalledWith(leafD);
    expect(visitor).toHaveBeenCalledTimes(1);

    // All nodes should be marked pending
    expect(nodeB.status).toBe(STATUS_PENDING);
    expect(nodeC.status).toBe(STATUS_PENDING);
    expect(leafD.status).toBe(STATUS_PENDING);
  });

  it('should handle complex diamond with backtracking after skipped nodes', () => {
    const traversal = createGraphTraversal();
    const visitor = vi.fn();

    // Complex case: A -> [B -> D, C -> D, E]
    // Where D gets processed twice (via B and C) AND we have E as another sibling
    // This should force backtracking after skipping already-processed D

    const leafD: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    const leafE: ConsumerNode = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
    };

    // Dependencies to D
    const depBtoD: Dependency = {
      consumer: leafD,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    const depCtoD: Dependency = {
      consumer: leafD, // Same consumer as B->D
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // Dependency to E
    const depAtoE: Dependency = {
      consumer: leafE,
      producer: {} as FromNode,
      nextConsumer: undefined,
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // B and C nodes with D as subscribers
    const nodeB: ConsumerNode & { subscribers: Dependency } = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      subscribers: depBtoD,
    };

    const nodeC: ConsumerNode & { subscribers: Dependency } = {
      __type: 'test',
      status: STATUS_CLEAN,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      subscribers: depCtoD,
    };

    // Dependencies from A
    const depAtoB: Dependency = {
      consumer: nodeB,
      producer: {} as FromNode,
      nextConsumer: undefined, // Will link to C
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    const depAtoC: Dependency = {
      consumer: nodeC,
      producer: {} as FromNode,
      nextConsumer: undefined, // Will link to E
      prevConsumer: undefined,
      nextDependency: undefined,
      prevDependency: undefined,
      version: 0,
    };

    // Chain siblings: B -> C -> E
    depAtoB.nextConsumer = depAtoC;
    depAtoC.nextConsumer = depAtoE;

    // Start traversal: should process B->D, then C (skip D), then E
    traversal.traverseGraph(depAtoB, visitor);

    // Should visit both D and E, each exactly once
    expect(visitor).toHaveBeenCalledWith(leafD);
    expect(visitor).toHaveBeenCalledWith(leafE);
    expect(visitor).toHaveBeenCalledTimes(2);

    // All nodes should be marked
    expect(nodeB.status).toBe(STATUS_PENDING);
    expect(nodeC.status).toBe(STATUS_PENDING);
    expect(leafD.status).toBe(STATUS_PENDING);
    expect(leafE.status).toBe(STATUS_PENDING);
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
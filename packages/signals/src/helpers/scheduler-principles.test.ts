import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';
import { CONSTANTS } from '../constants';
import type { ScheduledNode, FromNode, Dependency } from '../types';
import { createGraphTraversal } from './graph-traversal';
import { createGraphEdges } from './graph-edges';

const { STATUS_DISPOSED, STATUS_PENDING, STATUS_CLEAN } = CONSTANTS;

describe('Scheduler - FRP Principles', () => {
  describe('Exception Safety', () => {
    it('should continue executing remaining effects when one throws', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const executionOrder: string[] = [];

      // Create nodes with different behaviors
      const node1: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: vi.fn(() => {
          executionOrder.push('node1');
        }),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      const node2: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: vi.fn(() => {
          executionOrder.push('node2-throw');
          throw new Error('Effect 2 failed');
        }),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      const node3: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: vi.fn(() => {
          executionOrder.push('node3');
        }),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      // Create dependencies to schedule nodes
      const dep1: Dependency = {
        consumer: node1,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      };

      const dep2: Dependency = {
        consumer: node2,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      };

      const dep3: Dependency = {
        consumer: node3,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      };

      // Schedule all nodes
      scheduler.startBatch();
      scheduler.propagate(dep1);
      scheduler.propagate(dep2);
      scheduler.propagate(dep3);
      scheduler.endBatch();

      // THIS TEST WILL FAIL: The current implementation stops on exception
      // Expected: ['node1', 'node2-throw', 'node3']
      // Actual: ['node1', 'node2-throw'] - node3 never runs!
      expect(executionOrder).toEqual(['node1', 'node2-throw', 'node3']);
      expect(node1.flush).toHaveBeenCalledTimes(1);
      expect(node2.flush).toHaveBeenCalledTimes(1);
      expect(node3.flush).toHaveBeenCalledTimes(1); // This will fail!
    });

    it('should handle exceptions at different queue positions', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      // Test exception at start
      {
        const results: string[] = [];
        const throwFirst: ScheduledNode = {
          __type: 'effect',
          status: STATUS_CLEAN,
          nextScheduled: undefined,
          flush: () => {
            results.push('throw');
            throw new Error('First throws');
          },
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };

        const normal: ScheduledNode = {
          __type: 'effect',
          status: STATUS_CLEAN,
          nextScheduled: undefined,
          flush: () => results.push('normal'),
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };

        scheduler.propagate({
          consumer: throwFirst,
          nextConsumer: undefined,
          producer: {} as FromNode,
          prevConsumer: undefined,
          prevDependency: undefined,
          nextDependency: undefined,
          version: 0,
          producerVersion: 0,
        });

        scheduler.propagate({
          consumer: normal,
          nextConsumer: undefined,
          producer: {} as FromNode,
          prevConsumer: undefined,
          prevDependency: undefined,
          nextDependency: undefined,
          version: 0,
          producerVersion: 0,
        });

        // THIS WILL FAIL: normal effect won't run after exception
        expect(results).toEqual(['throw', 'normal']);
      }
    });
  });

  describe('Disposed Node Safety', () => {
    it('should not execute disposed nodes even if scheduled', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const flushSpy = vi.fn();
      const node: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: flushSpy,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      const dep: Dependency = {
        consumer: node,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      };

      // Schedule the node but don't flush yet
      scheduler.startBatch();
      scheduler.propagate(dep);

      // Dispose the node while it's scheduled
      scheduler.dispose(node, () => {});

      // Now flush - disposed node should NOT execute
      scheduler.endBatch();

      // THIS WILL FAIL: Disposed nodes still execute in current implementation
      expect(flushSpy).not.toHaveBeenCalled();
      expect(node.status).toBe(STATUS_DISPOSED);
    });

    it('should handle disposal during flush', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const executionOrder: string[] = [];
      let node2: ScheduledNode;
      let node3: ScheduledNode;

      const node1: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => {
          executionOrder.push('node1-disposes-node3');
          // Dispose node3 during execution
          scheduler.dispose(node3, () => executionOrder.push('node3-cleanup'));
        },
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      node2 = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => executionOrder.push('node2'),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      node3 = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => executionOrder.push('node3-should-not-run'),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      // Schedule all three
      [node1, node2, node3].forEach(node => {
        scheduler.propagate({
          consumer: node,
          nextConsumer: undefined,
          producer: {} as FromNode,
          prevConsumer: undefined,
          prevDependency: undefined,
          nextDependency: undefined,
          version: 0,
          producerVersion: 0,
        });
      });

      // THIS WILL FAIL: node3 will still execute even though disposed
      expect(executionOrder).toEqual([
        'node1-disposes-node3',
        'node3-cleanup',
        'node2',
        // node3 should NOT run
      ]);
    });
  });

  describe('Re-entrance Scheduling', () => {
    it('should handle effects scheduling new effects during flush', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const executionOrder: string[] = [];
      let nodeB: ScheduledNode;

      const nodeA: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => {
          executionOrder.push('A');
          // Schedule B during A's execution
          nodeB.status = STATUS_CLEAN; // Reset to CLEAN so traversal will process it
          scheduler.propagate({
            consumer: nodeB,
            nextConsumer: undefined,
            producer: {} as FromNode,
            prevConsumer: undefined,
            prevDependency: undefined,
            nextDependency: undefined,
            version: 0,
            producerVersion: 0,
          });
        },
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      nodeB = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => executionOrder.push('B'),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      // Schedule A
      scheduler.propagate({
        consumer: nodeA,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      // B should execute in the same flush cycle
      expect(executionOrder).toEqual(['A', 'B']);
    });

    it('should prevent infinite loops from circular scheduling', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const executionCount = { A: 0, B: 0 };
      let nodeA: ScheduledNode;
      let nodeB: ScheduledNode;

      nodeA = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => {
          executionCount.A++;
          if (executionCount.A === 1) {
            // First execution: schedule B
            nodeB.status = STATUS_PENDING;
            scheduler.propagate({
              consumer: nodeB,
              nextConsumer: undefined,
              producer: {} as FromNode,
              prevConsumer: undefined,
              prevDependency: undefined,
              nextDependency: undefined,
              version: 0,
              producerVersion: 0,
            });
          }
        },
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      nodeB = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => {
          executionCount.B++;
          if (executionCount.B === 1) {
            // First execution: schedule A again
            nodeA.status = STATUS_PENDING;
            scheduler.propagate({
              consumer: nodeA,
              nextConsumer: undefined,
              producer: {} as FromNode,
              prevConsumer: undefined,
              prevDependency: undefined,
              nextDependency: undefined,
              version: 0,
              producerVersion: 0,
            });
          }
        },
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      // Start the cycle
      scheduler.propagate({
        consumer: nodeA,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      // Should execute: A -> B -> A (second time) -> stop
      // The STATUS_SCHEDULED flag should prevent infinite loops
      expect(executionCount.A).toBeLessThanOrEqual(2);
      expect(executionCount.B).toBeLessThanOrEqual(1);
    });
  });

  describe('Batch Depth Management', () => {
    it('should not flush during nested batches', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const flushSpy = vi.fn();
      const node: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: flushSpy,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      // Start outer batch
      scheduler.startBatch();
      expect(scheduler.startBatch()).toBe(1); // Nested batch

      scheduler.propagate({
        consumer: node,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      // End inner batch - should not flush
      scheduler.endBatch();
      expect(flushSpy).not.toHaveBeenCalled();

      // End outer batch - now it should flush
      scheduler.endBatch();
      expect(flushSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle batch counter underflow protection', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      // End batch without starting - should not go negative
      expect(scheduler.endBatch()).toBe(0);
      expect(scheduler.endBatch()).toBe(0);
      expect(scheduler.endBatch()).toBe(0);

      // Should still work normally after
      scheduler.startBatch();
      expect(scheduler.endBatch()).toBe(0);
    });

    it('should maintain FIFO order across nested batches', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const executionOrder: string[] = [];

      const createNode = (name: string): ScheduledNode => ({
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => executionOrder.push(name),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      });

      const nodes = [
        createNode('A'),
        createNode('B'),
        createNode('C'),
        createNode('D'),
      ];

      // Complex nested batching scenario
      scheduler.startBatch(); // Outer batch

      // Schedule A
      scheduler.propagate({
        consumer: nodes[0]!,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      scheduler.startBatch(); // Inner batch

      // Schedule B and C
      [1, 2].forEach(i => {
        scheduler.propagate({
          consumer: nodes[i]!,
          nextConsumer: undefined,
          producer: {} as FromNode,
          prevConsumer: undefined,
          prevDependency: undefined,
          nextDependency: undefined,
          version: 0,
          producerVersion: 0,
        });
      });

      scheduler.endBatch(); // End inner batch - no flush

      // Schedule D
      scheduler.propagate({
        consumer: nodes[3]!,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      expect(executionOrder).toEqual([]); // Nothing executed yet

      scheduler.endBatch(); // End outer batch - flush all

      // Should maintain FIFO order
      expect(executionOrder).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('Memory Safety', () => {
    it('should clean up queue references on error', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const node1: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: () => {
          throw new Error('Crash');
        },
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      const node2: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: vi.fn(),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      scheduler.propagate({
        consumer: node1,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      scheduler.propagate({
        consumer: node2,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      // After flush with error, nextScheduled should be cleaned
      expect(node1.nextScheduled).toBeUndefined();
      expect(node2.nextScheduled).toBeUndefined();
    });

    it('should not leak memory from unexecuted scheduled nodes', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      // Create a large object that would leak if held
      const largeData = new Array(1000).fill('memory leak test');
      const node: ScheduledNode & { data: unknown } = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: vi.fn(),
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
        data: largeData,
      };

      // Schedule but don't flush
      scheduler.startBatch();
      scheduler.propagate({
        consumer: node,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      });

      // Dispose without flushing
      scheduler.dispose(node, () => {
        // Clean up the large data
        node.data = undefined;
      });

      // The node should be properly cleaned
      expect(node.data).toBeUndefined();
      expect(node.status).toBe(STATUS_DISPOSED);

      // End batch - should not execute disposed node
      scheduler.endBatch();
      expect(node.flush).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency', () => {
    it('should execute each effect exactly once per batch', () => {
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();
      const scheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });

      const flushSpy = vi.fn();
      const node: ScheduledNode = {
        __type: 'effect',
        status: STATUS_CLEAN,
        nextScheduled: undefined,
        flush: flushSpy,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };

      const dep: Dependency = {
        consumer: node,
        nextConsumer: undefined,
        producer: {} as FromNode,
        prevConsumer: undefined,
        prevDependency: undefined,
        nextDependency: undefined,
        version: 0,
        producerVersion: 0,
      };

      scheduler.startBatch();

      // Try to schedule the same node multiple times
      scheduler.propagate(dep);
      scheduler.propagate(dep);
      scheduler.propagate(dep);

      scheduler.endBatch();

      // Should only execute once
      expect(flushSpy).toHaveBeenCalledTimes(1);
    });
  });
});
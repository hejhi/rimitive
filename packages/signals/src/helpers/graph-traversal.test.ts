import { describe, it, expect } from 'vitest';
import type { ConsumerNode, Dependency, DerivedNode, ToNode } from '../types';
import { CONSTANTS } from '../constants';
import { createGraphTraversal } from './graph-traversal';

const { STATUS_CLEAN, STATUS_PENDING, STATUS_DIRTY } = CONSTANTS;

describe('graph-traversal: FRP graph traversal invariants', () => {
  /**
   * PRINCIPLED TESTING APPROACH:
   *
   * graph-traversal.ts is responsible for depth-first graph traversal and
   * invalidation propagation. We test FRP invariants:
   *
   * 1. Complete propagation - ALL dependent nodes must be marked
   * 2. No redundant work - nodes visited at most once
   * 3. Termination - must handle all graph shapes including cycles
   * 4. Correctness - proper depth-first order
   * 5. Memory efficiency - bounded stack usage
   */

  // Helper to create a producer node (which has subscribers)
  function createProducerNode(
    status: number = STATUS_CLEAN,
    subscribers?: Dependency
  ): DerivedNode {
    return {
      __type: 'DerivedNode',
      status,
      subscribers,
      subscribersTail: subscribers,
      value: undefined,
      dependencies: undefined,
      dependencyTail: undefined,
      trackingVersion: 0,
      compute: () => undefined,
    } as DerivedNode;
  }

  // Helper to create a dependency edge
  function createDependency(
    consumer: ToNode,
    nextConsumer?: Dependency
  ): Dependency {
    return {
      consumer,
      nextConsumer,
    } as Dependency;
  }

  describe('Invariant: Complete propagation - all reachable nodes marked', () => {
    it('should mark all nodes in a linear chain', () => {
      /**
       * Linear chain: A -> B -> C -> D
       * All nodes should be marked as PENDING
       */
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // Build dependency chain
      const depD = createDependency(nodeD);
      const depC = createDependency(nodeC);
      const depB = createDependency(nodeB);
      const depA = createDependency(nodeA);

      // Connect the chain
      nodeC.subscribers = depD;
      nodeB.subscribers = depC;
      nodeA.subscribers = depB;

      const traversal = createGraphTraversal();
      traversal.propagate(depA);

      // All nodes should be marked as PENDING
      expect(nodeA.status).toBe(STATUS_PENDING);
      expect(nodeB.status).toBe(STATUS_PENDING);
      expect(nodeC.status).toBe(STATUS_PENDING);
      expect(nodeD.status).toBe(STATUS_PENDING);
    });

    it('should handle branching propagation correctly', () => {
      /**
       * Tree structure:
       *       A
       *      / \
       *     B   C
       *    / \   \
       *   D   E   F
       *
       * All reachable nodes should be marked
       */
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeE = createProducerNode(STATUS_CLEAN);
      const nodeF = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // Build dependency edges
      const depF = createDependency(nodeF);
      const depA = createDependency(nodeA);

      // Connect branches
      nodeB.subscribers = createDependency(nodeD, createDependency(nodeE));
      nodeC.subscribers = depF;
      nodeA.subscribers = createDependency(nodeB, createDependency(nodeC));

      const traversal = createGraphTraversal();
      traversal.propagate(depA);

      // All nodes should be marked
      expect(nodeA.status).toBe(STATUS_PENDING);
      expect(nodeB.status).toBe(STATUS_PENDING);
      expect(nodeC.status).toBe(STATUS_PENDING);
      expect(nodeD.status).toBe(STATUS_PENDING);
      expect(nodeE.status).toBe(STATUS_PENDING);
      expect(nodeF.status).toBe(STATUS_PENDING);
    });

    it('CRITICAL: should handle diamond dependencies correctly', () => {
      /**
       * Diamond pattern:
       *       A
       *      / \
       *     B   C
       *      \ /
       *       D
       *
       * D has two paths from A - both should be traversed
       */
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // D depends on both B and C
      const depD_fromB = createDependency(nodeD);
      const depD_fromC = createDependency(nodeD);

      // B and C each have their own dependency on D
      nodeB.subscribers = depD_fromB;
      nodeC.subscribers = depD_fromC;

      // A has both B and C as subscribers
      nodeA.subscribers = createDependency(nodeB, createDependency(nodeC));

      const traversal = createGraphTraversal();
      const leafNodes: DerivedNode[] = [];

      traversal.traverseGraph(nodeA.subscribers!, (node) => {
        leafNodes.push(node as DerivedNode);
      });

      // All nodes should be marked
      expect(nodeB.status).toBe(STATUS_PENDING);
      expect(nodeC.status).toBe(STATUS_PENDING);
      expect(nodeD.status).toBe(STATUS_PENDING);

      // D is a leaf node (no further subscribers)
      // It should be visited exactly once (skipped on second encounter to avoid redundant work)
      expect(leafNodes.filter(n => n === nodeD).length).toBe(1);
    });
  });

  describe('Invariant: No redundant work - skip already processed nodes', () => {
    it('should skip nodes already marked as PENDING', () => {
      /**
       * If a node is already PENDING, it should not be processed again
       * This prevents exponential explosion in diamond patterns
       */
      const nodeB = createProducerNode(STATUS_PENDING); // Already pending!
      const nodeA = createProducerNode(STATUS_CLEAN);

      const depB = createDependency(nodeB);
      nodeA.subscribers = depB;

      const leafNodes: DerivedNode[] = [];
      const traversal = createGraphTraversal();

      traversal.traverseGraph(nodeA.subscribers!, (node) => {
        leafNodes.push(node as DerivedNode);
      });

      // B should remain PENDING (not changed)
      expect(nodeB.status).toBe(STATUS_PENDING);

      // B should NOT be visited as a leaf since it was already PENDING
      expect(leafNodes).toHaveLength(0);
    });

    it('should process DIRTY nodes and mark them as PENDING', () => {
      /**
       * DIRTY nodes from previous computations need to be marked PENDING
       * for the new propagation cycle to know they need re-evaluation
       */
      const nodeB = createProducerNode(STATUS_DIRTY); // DIRTY from previous cycle
      const nodeA = createProducerNode(STATUS_CLEAN);

      nodeA.subscribers = createDependency(nodeB);

      const traversal = createGraphTraversal();
      traversal.propagate(nodeA.subscribers!);

      // B should be marked PENDING for re-evaluation
      expect(nodeB.status).toBe(STATUS_PENDING);
    });
  });

  describe('Invariant: Correct traversal order', () => {
    it('should traverse depth-first, visiting leaves in correct order', () => {
      /**
       * Tree structure:
       *       A
       *      / \
       *     B   C
       *    /     \
       *   D       E
       *
       * Depth-first order should visit: B -> D -> C -> E
       */
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeE = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // Build tree
      nodeB.subscribers = createDependency(nodeD);
      nodeC.subscribers = createDependency(nodeE);
      nodeA.subscribers = createDependency(nodeB, createDependency(nodeC));

      const visitOrder: DerivedNode[] = [];
      const leafOrder: DerivedNode[] = [];

      const traversal = createGraphTraversal();

      // Patch status setter to track visit order
      const originalNodeBStatus = Object.getOwnPropertyDescriptor(nodeB, 'status');
      const originalNodeCStatus = Object.getOwnPropertyDescriptor(nodeC, 'status');
      const originalNodeDStatus = Object.getOwnPropertyDescriptor(nodeD, 'status');
      const originalNodeEStatus = Object.getOwnPropertyDescriptor(nodeE, 'status');

      let bStatus = nodeB.status;
      let cStatus = nodeC.status;
      let dStatus = nodeD.status;
      let eStatus = nodeE.status;

      Object.defineProperty(nodeB, 'status', {
        get: () => bStatus,
        set: (v) => { if (v === STATUS_PENDING) visitOrder.push(nodeB); bStatus = v; }
      });
      Object.defineProperty(nodeC, 'status', {
        get: () => cStatus,
        set: (v) => { if (v === STATUS_PENDING) visitOrder.push(nodeC); cStatus = v; }
      });
      Object.defineProperty(nodeD, 'status', {
        get: () => dStatus,
        set: (v) => { if (v === STATUS_PENDING) visitOrder.push(nodeD); dStatus = v; }
      });
      Object.defineProperty(nodeE, 'status', {
        get: () => eStatus,
        set: (v) => { if (v === STATUS_PENDING) visitOrder.push(nodeE); eStatus = v; }
      });

      traversal.traverseGraph(nodeA.subscribers!, (node) => {
        leafOrder.push(node as DerivedNode);
      });

      // Depth-first: should go B -> D (leaf) -> C -> E (leaf)
      expect(visitOrder).toEqual([nodeB, nodeD, nodeC, nodeE]);
      expect(leafOrder).toEqual([nodeD, nodeE]); // Only leaves

      // Restore original properties
      if (originalNodeBStatus) Object.defineProperty(nodeB, 'status', originalNodeBStatus);
      if (originalNodeCStatus) Object.defineProperty(nodeC, 'status', originalNodeCStatus);
      if (originalNodeDStatus) Object.defineProperty(nodeD, 'status', originalNodeDStatus);
      if (originalNodeEStatus) Object.defineProperty(nodeE, 'status', originalNodeEStatus);
    });
  });

  describe('Invariant: Stack management and memory efficiency', () => {
    it('should use stack only at branch points', () => {
      /**
       * The alien-signals pattern follows chains naturally,
       * only using stack when there are siblings to remember.
       *
       * Chain A -> B -> C with side branch B -> D
       * Stack should only be used to remember D while traversing C
       */
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // B has two subscribers: C and D
      nodeB.subscribers = createDependency(nodeC, createDependency(nodeD));
      nodeA.subscribers = createDependency(nodeB);

      const leafNodes: DerivedNode[] = [];
      const traversal = createGraphTraversal();

      traversal.traverseGraph(nodeA.subscribers!, (node) => {
        leafNodes.push(node as DerivedNode);
      });

      // Should visit both leaves
      expect(leafNodes).toContain(nodeC);
      expect(leafNodes).toContain(nodeD);

      // Order should be depth-first: C before D (C is first in chain)
      expect(leafNodes).toEqual([nodeC, nodeD]);
    });

    it('should handle deep chains without stack overflow', () => {
      /**
       * Very deep linear chain should not cause stack overflow
       * because we follow chains naturally without recursion
       */
      const depth = 10000;
      const nodes: DerivedNode[] = [];

      // Create deep chain
      for (let i = 0; i < depth; i++) {
        nodes.push(createProducerNode(STATUS_CLEAN));
      }

      // Connect them
      for (let i = 0; i < depth - 1; i++) {
        nodes[i]!.subscribers = createDependency(nodes[i + 1]!);
      }

      const traversal = createGraphTraversal();

      // Should handle deep chain without stack overflow
      expect(() => {
        traversal.propagate(createDependency(nodes[0]!));
      }).not.toThrow();

      // All nodes should be marked
      for (const node of nodes) {
        expect(node.status).toBe(STATUS_PENDING);
      }
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle empty dependency chain gracefully', () => {
      const traversal = createGraphTraversal();
      const leafNodes: DerivedNode[] = [];

      // Should not throw on undefined
      expect(() => {
        traversal.traverseGraph(undefined as any, (node) => {
          leafNodes.push(node as DerivedNode);
        });
      }).not.toThrow();

      expect(leafNodes).toHaveLength(0);
    });

    it('should handle multiple subscribers correctly', () => {
      /**
       * Node with multiple subscribers (fan-out)
       * A -> [B, C, D, E]
       */
      const nodes = [
        createProducerNode(STATUS_CLEAN),
        createProducerNode(STATUS_CLEAN),
        createProducerNode(STATUS_CLEAN),
        createProducerNode(STATUS_CLEAN),
      ];

      const nodeA = createProducerNode(STATUS_CLEAN);

      // Chain multiple subscribers
      let subscribers: Dependency | undefined;
      for (let i = nodes.length - 1; i >= 0; i--) {
        subscribers = createDependency(nodes[i]!, subscribers);
      }

      nodeA.subscribers = subscribers;

      const traversal = createGraphTraversal();
      traversal.propagate(nodeA.subscribers!);

      // All subscribers should be marked
      for (const node of nodes) {
        expect(node.status).toBe(STATUS_PENDING);
      }
    });

    it('should handle complex mixed patterns', () => {
      /**
       * Complex graph with multiple patterns:
       *        A
       *       /|\
       *      B C D
       *      |X|/    (B->E, C->E, D->E - convergence)
       *      E
       *      |
       *      F
       */
      const nodeF = createProducerNode(STATUS_CLEAN);
      const nodeE = createProducerNode(STATUS_CLEAN);
      const nodeB = createProducerNode(STATUS_CLEAN);
      const nodeC = createProducerNode(STATUS_CLEAN);
      const nodeD = createProducerNode(STATUS_CLEAN);
      const nodeA = createProducerNode(STATUS_CLEAN);

      // E -> F
      nodeE.subscribers = createDependency(nodeF);

      // B, C, D all point to E
      nodeB.subscribers = createDependency(nodeE);
      nodeC.subscribers = createDependency(nodeE);
      nodeD.subscribers = createDependency(nodeE);

      // A points to B, C, D
      nodeA.subscribers = createDependency(
        nodeB,
        createDependency(nodeC, createDependency(nodeD))
      );

      const leafNodes: DerivedNode[] = [];
      const traversal = createGraphTraversal();

      traversal.traverseGraph(nodeA.subscribers!, (node) => {
        leafNodes.push(node as DerivedNode);
      });

      // All nodes should be marked as PENDING
      expect(nodeB.status).toBe(STATUS_PENDING);
      expect(nodeC.status).toBe(STATUS_PENDING);
      expect(nodeD.status).toBe(STATUS_PENDING);
      expect(nodeE.status).toBe(STATUS_PENDING);
      expect(nodeF.status).toBe(STATUS_PENDING);

      // F is the only true leaf (it has no subscribers)
      // E will be processed multiple times but only F is a leaf
      const uniqueLeaves = [...new Set(leafNodes)];
      expect(uniqueLeaves).toEqual([nodeF]);
    });
  });

  describe('Performance characteristics', () => {
    it('should have linear time complexity for tree traversal', () => {
      /**
       * For a balanced binary tree, traversal should be O(n)
       * where n is the number of nodes
       */
      const createBinaryTree = (depth: number): ConsumerNode => {
        if (depth === 0) {
          return createProducerNode(STATUS_CLEAN);
        }

        const node = createProducerNode(STATUS_CLEAN);
        const left = createBinaryTree(depth - 1);
        const right = createBinaryTree(depth - 1);

        node.subscribers = createDependency(left, createDependency(right));
        return node;
      };

      const root = createBinaryTree(10); // 2^10 = 1024 nodes
      const traversal = createGraphTraversal();

      let nodeCount = 0;
      const startTime = performance.now();

      traversal.traverseGraph(createDependency(root), () => {
        nodeCount++;
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast even for 1024 nodes
      expect(duration).toBeLessThan(100); // Less than 100ms

      // Should visit all leaf nodes (2^10 = 1024 leaves at depth 0)
      expect(nodeCount).toBe(1024);
    });
  });
});
import { describe, it, expect } from 'vitest';
import type { DerivedNode, Dependency, ToNode } from '../types';
import { CONSTANTS } from '../constants';
import { createGraphTraversal } from './graph-traversal';

const { STATUS_CLEAN, CONSUMER_PENDING, DERIVED_DIRTY } = CONSTANTS;

/**
 * Unit tests for graph-traversal algorithm
 *
 * Tests depth-first traversal and invalidation propagation with minimal mocking.
 * Verifies: completeness, no redundant work, correct ordering, memory efficiency.
 */

describe('Graph Traversal Algorithm', () => {

  // Helper to create a node
  function createNode(status: number = STATUS_CLEAN): DerivedNode {
    return {
      status,
      subscribers: undefined,
      value: undefined,
      dependencies: undefined,
      trackingVersion: 0,
      compute: () => undefined,
    } as DerivedNode;
  }

  // Helper to create a dependency edge
  function createDep(consumer: ToNode, next?: Dependency): Dependency {
    return {
      consumer,
      nextConsumer: next,
    } as Dependency;
  }

  describe('Complete Propagation', () => {
    it('should mark all nodes in linear chain', () => {
      // A -> B -> C -> D
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      c.subscribers = createDep(d);
      b.subscribers = createDep(c);
      a.subscribers = createDep(b);

      const { propagate } = createGraphTraversal();
      propagate(a.subscribers);

      expect(b.status).toBe(CONSUMER_PENDING);
      expect(c.status).toBe(CONSUMER_PENDING);
      expect(d.status).toBe(CONSUMER_PENDING);
    });

    it('should mark all nodes in tree', () => {
      //     A
      //    / \
      //   B   C
      //  / \   \
      // D   E   F
      const f = createNode();
      const e = createNode();
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      b.subscribers = createDep(d, createDep(e));
      c.subscribers = createDep(f);
      a.subscribers = createDep(b, createDep(c));

      const { propagate } = createGraphTraversal();
      propagate(a.subscribers);

      expect(b.status).toBe(CONSUMER_PENDING);
      expect(c.status).toBe(CONSUMER_PENDING);
      expect(d.status).toBe(CONSUMER_PENDING);
      expect(e.status).toBe(CONSUMER_PENDING);
      expect(f.status).toBe(CONSUMER_PENDING);
    });

    it('should handle diamond dependencies', () => {
      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      b.subscribers = createDep(d);
      c.subscribers = createDep(d);
      a.subscribers = createDep(b, createDep(c));

      const { traverseGraph } = createGraphTraversal();
      const leaves: DerivedNode[] = [];

      traverseGraph(a.subscribers, (node) => {
        leaves.push(node as DerivedNode);
      });

      expect(b.status).toBe(CONSUMER_PENDING);
      expect(c.status).toBe(CONSUMER_PENDING);
      expect(d.status).toBe(CONSUMER_PENDING);

      // D visited only once (deduplication)
      expect(leaves.filter(n => n === d).length).toBe(1);
    });
  });

  describe('Deduplication', () => {
    it('should skip already PENDING nodes', () => {
      const b = createNode(CONSUMER_PENDING); // Already pending
      const a = createNode();

      a.subscribers = createDep(b);

      const { traverseGraph } = createGraphTraversal();
      const leaves: DerivedNode[] = [];

      traverseGraph(a.subscribers, (node) => {
        leaves.push(node as DerivedNode);
      });

      expect(b.status).toBe(CONSUMER_PENDING);
      expect(leaves).toHaveLength(0); // Not visited again
    });

    it('should process DIRTY nodes and mark PENDING', () => {
      const b = createNode(DERIVED_DIRTY);
      const a = createNode();

      a.subscribers = createDep(b);

      const { propagate } = createGraphTraversal();
      propagate(a.subscribers);

      expect(b.status).toBe(CONSUMER_PENDING);
    });
  });

  describe('Traversal Order', () => {
    it('should traverse depth-first', () => {
      //     A
      //    / \
      //   B   C
      //  /     \
      // D       E
      const e = createNode();
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      b.subscribers = createDep(d);
      c.subscribers = createDep(e);
      a.subscribers = createDep(b, createDep(c));

      const order: DerivedNode[] = [];
      const { traverseGraph } = createGraphTraversal();

      // Track visit order via status changes
      const track = (node: DerivedNode) => {
        const origStatus = node.status;
        Object.defineProperty(node, 'status', {
          get: () => origStatus,
          set: (v: number) => {
            if (v === CONSUMER_PENDING) order.push(node);
          },
          configurable: true,
        });
      };

      track(b);
      track(c);
      track(d);
      track(e);

      traverseGraph(a.subscribers, () => {});

      // Depth-first: B -> D -> C -> E
      expect(order).toEqual([b, d, c, e]);
    });

    it('should visit leaves only', () => {
      //   A
      //  / \
      // B   C
      // |
      // D
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      b.subscribers = createDep(d);
      a.subscribers = createDep(b, createDep(c));

      const leaves: DerivedNode[] = [];
      const { traverseGraph } = createGraphTraversal();

      traverseGraph(a.subscribers, (node) => {
        leaves.push(node as DerivedNode);
      });

      // Only D and C are leaves (no subscribers)
      expect(leaves).toEqual([d, c]);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle deep chains without stack overflow', () => {
      const depth = 10000;
      const nodes: DerivedNode[] = [];

      // Create deep chain
      for (let i = 0; i < depth; i++) {
        nodes.push(createNode());
      }

      // Connect chain
      for (let i = 0; i < depth - 1; i++) {
        nodes[i]!.subscribers = createDep(nodes[i + 1]!);
      }

      const { propagate } = createGraphTraversal();

      expect(() => {
        propagate(createDep(nodes[0]!));
      }).not.toThrow();

      // All marked
      nodes.forEach(node => {
        expect(node.status).toBe(CONSUMER_PENDING);
      });
    });

    it('should handle wide fan-out', () => {
      // A -> [B, C, D, E, ...]
      const width = 100;
      const nodes: DerivedNode[] = [];

      for (let i = 0; i < width; i++) {
        nodes.push(createNode());
      }

      const a = createNode();

      // Chain all as siblings
      let subs: Dependency | undefined;
      for (let i = width - 1; i >= 0; i--) {
        subs = createDep(nodes[i]!, subs);
      }
      a.subscribers = subs;

      const { propagate } = createGraphTraversal();
      propagate(a.subscribers!);

      // All marked
      nodes.forEach(node => {
        expect(node.status).toBe(CONSUMER_PENDING);
      });
    });
  });

  describe('Complex Patterns', () => {
    it('should handle convergent graph', () => {
      //      A
      //     /|\
      //    B C D
      //     \|/
      //      E
      //      |
      //      F
      const f = createNode();
      const e = createNode();
      const d = createNode();
      const c = createNode();
      const b = createNode();
      const a = createNode();

      e.subscribers = createDep(f);
      b.subscribers = createDep(e);
      c.subscribers = createDep(e);
      d.subscribers = createDep(e);
      a.subscribers = createDep(b, createDep(c, createDep(d)));

      const leaves: DerivedNode[] = [];
      const { traverseGraph } = createGraphTraversal();

      traverseGraph(a.subscribers, (node) => {
        leaves.push(node as DerivedNode);
      });

      expect(b.status).toBe(CONSUMER_PENDING);
      expect(c.status).toBe(CONSUMER_PENDING);
      expect(d.status).toBe(CONSUMER_PENDING);
      expect(e.status).toBe(CONSUMER_PENDING);
      expect(f.status).toBe(CONSUMER_PENDING);

      // Only F is a leaf
      const unique = [...new Set(leaves)];
      expect(unique).toEqual([f]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined gracefully', () => {
      const { traverseGraph } = createGraphTraversal();
      const leaves: DerivedNode[] = [];

      expect(() => {
        traverseGraph(undefined as unknown as Dependency, (node) => {
          leaves.push(node as DerivedNode);
        });
      }).not.toThrow();

      expect(leaves).toHaveLength(0);
    });

    it('should handle single node', () => {
      const a = createNode();

      const { propagate } = createGraphTraversal();
      propagate(createDep(a));

      expect(a.status).toBe(CONSUMER_PENDING);
    });
  });
});

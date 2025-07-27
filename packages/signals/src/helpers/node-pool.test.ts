import { describe, it, expect, beforeEach } from 'vitest';
import { createNodePoolHelpers } from './node-pool';
import { createContext } from '../context';
import type { SignalContext } from '../context';
import type { Producer, Consumer, Edge } from '../types';

describe('Node Pool Helpers', () => {
  let ctx: SignalContext;
  let helpers: ReturnType<typeof createNodePoolHelpers>;

  beforeEach(() => {
    ctx = createContext();
    helpers = createNodePoolHelpers(ctx);
  });

  describe('acquireNode', () => {
    it('should acquire nodes from pool when available', () => {
      const initialPoolSize = ctx.poolSize;
      const node = helpers.acquireNode();
      
      expect(node).toBeDefined();
      expect(ctx.poolSize).toBe(initialPoolSize - 1);
      expect(ctx.allocations).toBe(1);
    });

    it('should create new nodes when pool is empty', () => {
      // Drain the pool
      const nodesToDrain = ctx.poolSize;
      for (let i = 0; i < nodesToDrain; i++) {
        helpers.acquireNode();
      }
      
      expect(ctx.poolSize).toBe(0);
      
      // Acquire one more
      const node = helpers.acquireNode();
      
      expect(node).toBeDefined();
    });
  });

  describe('releaseNode', () => {
    it('should return nodes to pool', () => {
      const node = helpers.acquireNode();
      const initialPoolSize = ctx.poolSize;
      
      helpers.releaseNode(node);
      
      expect(ctx.poolSize).toBe(initialPoolSize + 1);
      expect(node.source).toBeUndefined();
      expect(node.target).toBeUndefined();
      expect(node.version).toBe(0);
      expect(node.nextSource).toBeUndefined();
      expect(node.prevSource).toBeUndefined();
      expect(node.nextTarget).toBeUndefined();
      expect(node.prevTarget).toBeUndefined();
    });

    it('should not exceed MAX_POOL_SIZE', () => {
      // Fill pool to max
      const MAX_POOL_SIZE = 1000; // From constants
      // Drain the initial pool first
      const initialPoolSize = ctx.poolSize;
      for (let i = 0; i < initialPoolSize; i++) {
        helpers.acquireNode();
      }
      
      // Now acquire more nodes than MAX_POOL_SIZE
      const nodes: Edge[] = [];
      for (let i = 0; i < MAX_POOL_SIZE + 100; i++) {
        nodes.push(helpers.acquireNode());
      }
      
      // Release all nodes back
      for (const node of nodes) {
        helpers.releaseNode(node);
      }
      
      // Pool should be capped at MAX_POOL_SIZE
      expect(ctx.poolSize).toBe(MAX_POOL_SIZE);
    });
  });

  describe('linkNodes', () => {
    it('should create bidirectional links between source and target', () => {
      const source: Producer = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      expect(node.source).toBe(source);
      expect(node.target).toBe(target);
      expect(node.version).toBe(1);
      expect(source._targets).toBe(node);
      expect(target._sources).toBe(node);
      expect(source._node).toBe(node);
    });

    it('should maintain linked lists when multiple dependencies exist', () => {
      const source: Producer = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target1: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      const target2: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      const node1 = helpers.linkNodes(source, target1, 1);
      const node2 = helpers.linkNodes(source, target2, 1);
      
      // Source should point to most recent target
      expect(source._targets).toBe(node2);
      expect(node2.nextTarget).toBe(node1);
      expect(node1.prevTarget).toBe(node2);
    });

    it('should set TRACKING flag for computed sources', () => {
      const source = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
        _flags: 0,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      helpers.linkNodes(source, target, 1);
      
      // TRACKING flag is 1 << 4 = 16
      expect(source._flags & 16).toBe(16);
    });
  });

  describe('removeFromTargets', () => {
    it('should remove node from targets list', () => {
      const source: Producer = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      helpers.removeFromTargets(node);
      
      expect(source._targets).toBeUndefined();
    });

    it('should maintain linked list integrity when removing middle node', () => {
      const source: Producer = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
      };
      
      const targets = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      }));
      
      const nodes = targets.map(target => 
        helpers.linkNodes(source, target, 1)
      );
      
      // Remove middle node
      helpers.removeFromTargets(nodes[1]!);
      
      // Check that nodes[0] and nodes[2] are still linked
      expect(nodes[2]!.nextTarget).toBe(nodes[0]);
      expect(nodes[0]!.prevTarget).toBe(nodes[2]);
    });

    it('should clear TRACKING flag when last target is removed', () => {
      const source = {
        value: 0,
        __type: 'test',
        _targets: undefined,
        _node: undefined,
        _version: 1,
        _flags: 16, // TRACKING flag set
      };
      
      const target: Consumer = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
        _flags: 0,
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      helpers.removeFromTargets(node);
      
      expect(source._flags & 16).toBe(0);
    });
  });
});
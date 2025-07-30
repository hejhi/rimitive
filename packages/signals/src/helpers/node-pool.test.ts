import { describe, it, expect, beforeEach } from 'vitest';
import { createNodePoolHelpers, EdgeCache } from './node-pool';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Node Pool Helpers', () => {
  let helpers: ReturnType<typeof createNodePoolHelpers>;

  beforeEach(() => {
    helpers = createNodePoolHelpers();
  });

  describe('linkNodes', () => {
    it('should create bidirectional links between source and target', () => {
      const source: ProducerNode & EdgeCache = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      expect(node.source).toBe(source);
      expect(node.target).toBe(target);
      expect(node.version).toBe(1);
      expect(source._targets).toBe(node);
      expect(target._sources).toBe(node);
      expect(source._lastEdge).toBe(node);
    });

    it('should maintain linked lists when multiple dependencies exist', () => {
      const source: ProducerNode & EdgeCache = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const target1: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const target2: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
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
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
        _flags: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      helpers.linkNodes(source, target, 1);
      
      // TRACKING flag is 1 << 4 = 16
      expect(source._flags & 16).toBe(16);
    });
  });

  describe('removeFromTargets', () => {
    it('should remove node from targets list', () => {
      const source: ProducerNode & EdgeCache = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      helpers.removeFromTargets(node);
      
      expect(source._targets).toBeUndefined();
    });

    it('should maintain linked list integrity when removing middle node', () => {
      const source: ProducerNode & EdgeCache = {
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
      };
      
      const targets = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      }) as ConsumerNode);
      
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
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: 1,
        _flags: 16, // TRACKING flag set
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      const node = helpers.linkNodes(source, target, 1);
      
      helpers.removeFromTargets(node);
      
      expect(source._flags & 16).toBe(0);
    });
  });
});
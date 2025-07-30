import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyHelpers, EdgeCache, TrackedProducer } from './dependency-tracking';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Dependency Tracking Helpers', () => {
  let helpers: ReturnType<typeof createDependencyHelpers>;

  beforeEach(() => {
    helpers = createDependencyHelpers();
  });

  describe('addDependency', () => {
    it('should reuse cached node when available', () => {
      const source: TrackedProducer = {
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
      
      // First call creates the dependency
      helpers.addDependency(source, target, 1);
      const cachedNode = source._lastEdge;
      
      // Update version
      source._version = 2;
      
      // Second call should reuse the cached node
      helpers.addDependency(source, target, 2);
      
      expect(source._lastEdge).toBe(cachedNode);
      expect(source._lastEdge?.version).toBe(2);
    });

    it('should find existing dependency in sources list', () => {
      const source: TrackedProducer = {
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
      
      // Create dependency manually
      const existingNode = helpers.linkNodes(source, target, 1);
      
      // Clear the cached node to force search
      source._lastEdge = undefined;
      
      // Update version
      source._version = 2;
      
      // Should find the existing dependency
      helpers.addDependency(source, target, 2);
      
      expect(existingNode.version).toBe(2);
      expect(target._sources).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: TrackedProducer = {
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
      
      helpers.addDependency(source, target, 1);
      
      expect(source._targets).toBeDefined();
      expect(target._sources).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, (_, i) => ({
        __type: 'test',
        _targets: undefined,
        _lastEdge: undefined,
        _version: i + 1,
      }));
      
      const target: ConsumerNode = {
        __type: 'test',
        _sources: undefined,
        _invalidate: () => {},
      };
      
      // Add dependencies from multiple sources
      sources.forEach(source => {
        helpers.addDependency(source, target, source._version);
      });
      
      // Count sources
      let count = 0;
      let node = target._sources;
      while (node) {
        count++;
        node = node.nextSource;
      }
      
      expect(count).toBe(3);
    });

    it('should update version when dependency already exists', () => {
      const source: TrackedProducer = {
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
      
      // Create initial dependency
      helpers.addDependency(source, target, 1);
      
      // Update version
      source._version = 5;
      
      // Update dependency
      helpers.addDependency(source, target, 5);
      
      // Check that version was updated
      const node = target._sources;
      expect(node?.version).toBe(5);
    });
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
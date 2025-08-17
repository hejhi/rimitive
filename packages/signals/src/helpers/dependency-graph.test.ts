import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Dependency Graph Helpers', () => {
  let helpers: ReturnType<typeof createDependencyGraph>;

  beforeEach(() => {
    helpers = createDependencyGraph();
  });

  describe('ensureLink', () => {
    it('should reuse edge when same producer accessed again', () => {
      const source: ProducerNode = {
        __type: 'test',
        _to: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _runVersion: 0,
      };
      
      // First call creates the dependency
      helpers.ensureLink(source, target, 1);
      const firstEdge = target._sources;
      
      // Update version
      source._version = 2;
      
      // Second call should reuse the same edge
      helpers.ensureLink(source, target, 2);
      
      expect(target._sources).toBe(firstEdge);
      expect(target._sources?.version).toBe(2);
    });

    it('should find existing dependency in sources list', () => {
      const source: ProducerNode = {
        __type: 'test',
        _to: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _runVersion: 0,
      };
      
      // Create dependency manually
      const existingNode = helpers.connect(source, target, 1);
      
      // Update version
      source._version = 2;
      
      // Should find the existing dependency
      helpers.ensureLink(source, target, 2);
      
      expect(existingNode.version).toBe(2);
      expect(target._sources).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        _to: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _runVersion: 0,
      };
      
      helpers.ensureLink(source, target, 1);
      
      expect(source._to).toBeDefined();
      expect(target._sources).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, (_, i) => ({
        __type: 'test',
        _to: undefined,
        _version: i + 1,
      }));
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _runVersion: 0,
      };
      
      // Add dependencies from multiple sources
      sources.forEach(source => {
        helpers.ensureLink(source as ProducerNode, target, (source as ProducerNode)._version);
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
      const source: ProducerNode = {
        __type: 'test',
        _to: undefined,
        _version: 1,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _sources: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _runVersion: 0,
      };
      
      // Create initial dependency
      helpers.ensureLink(source, target, 1);
      
      // Update version
      source._version = 5;
      
      // Update dependency
      helpers.ensureLink(source, target, 5);
      
      // Check that version was updated
      const node = target._sources;
      expect(node?.version).toBe(5);
    });
  });

  describe('connect', () => {
      it('should create bidirectional links between source and target', () => {
        const source: ProducerNode = {
          __type: 'test',
          _to: undefined,
          _version: 1,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
        _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        const node = helpers.connect(source, target, 1);
        
        expect(node.from).toBe(source);
        expect(node.to).toBe(target);
        expect(node.version).toBe(1);
        expect(source._to).toBe(node);
        expect(target._sources).toBe(node);
      });
  
      it('should maintain linked lists when multiple dependencies exist', () => {
        const source: ProducerNode = {
          __type: 'test',
          _to: undefined,
          _version: 1,
        };
        
        const target1: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        const target2: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        const node1 = helpers.connect(source, target1, 1);
        const node2 = helpers.connect(source, target2, 1);
        
        // Source should point to first target (head of list)
        expect(source._to).toBe(node1);
        // node1 should point to node2 (insertion order)
        expect(node1.nextTarget).toBe(node2);
        expect(node2.prevTarget).toBe(node1);
        // node2 should be the tail
        expect(source._targetsTail).toBe(node2);
      });
  
      it('should set TRACKING flag for computed sources', () => {
        const source = {
          __type: 'test',
          _to: undefined,
          _lastEdge: undefined,
          _version: 1,
          _flags: 0,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        helpers.connect(source, target, 1);
        
        // TRACKING flag is 1 << 4 = 16
        expect(source._flags & 16).toBe(16);
      });
    });
  
    describe('unlinkFromProducer', () => {
      it('should remove node from targets list', () => {
        const source: ProducerNode = {
          __type: 'test',
          _to: undefined,
          _version: 1,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        const node = helpers.connect(source, target, 1);
        
        helpers.unlinkFromProducer(node);
        
        expect(source._to).toBeUndefined();
      });
  
      it('should maintain linked list integrity when removing middle node', () => {
        const source: ProducerNode = {
          __type: 'test',
          _to: undefined,
          _version: 1,
        };
        
        const targets = Array.from({ length: 3 }, () => ({
          __type: 'test',
          _sources: undefined,
          _invalidate: () => {},
        }) as ConsumerNode);
        
        const nodes = targets.map(target => 
          helpers.connect(source, target, 1)
        );
        
        // Remove middle node
        helpers.unlinkFromProducer(nodes[1]!);
        
        // Check that nodes[0] and nodes[2] are still linked in correct order
        expect(nodes[0]!.nextTarget).toBe(nodes[2]);
        expect(nodes[2]!.prevTarget).toBe(nodes[0]);
      });
  
      it('should clear TRACKING flag when last target is removed', () => {
        const source = {
          __type: 'test',
          _to: undefined,
          _version: 1,
          _flags: 16, // TRACKING flag set
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _sources: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _runVersion: 0,
        };
        
        const node = helpers.connect(source, target, 1);
        
        helpers.unlinkFromProducer(node);
        
        expect(source._flags & 16).toBe(0);
      });
    });
});

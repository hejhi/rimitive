import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import type { ConsumerNode, ProducerNode } from '../types';

describe('Dependency Graph Helpers', () => {
  let helpers: ReturnType<typeof createDependencyGraph>;

  beforeEach(() => {
    helpers = createDependencyGraph();
  });

  describe('link', () => {
    it('should reuse edge when same producer accessed again', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _version: 1,
        _outTail: undefined
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _gen: 0,
        _inTail: undefined,
      };
      
      // First call creates the dependency
      helpers.link(source, target, 1);
      const firstEdge = target._in;
      
      // Update version
      source._version = 2;
      
      // Second call should reuse the same edge
      helpers.link(source, target, 2);
      
      expect(target._in).toBe(firstEdge);
      expect(target._in?.fromVersion).toBe(2);
    });

    it('should find existing dependency in sources list', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _version: 1,
        _outTail: undefined,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _gen: 0,
        _inTail: undefined,
      };
      
      // Create dependency manually
      helpers.link(source, target, 1);
      const existingNode = target._in!;
      
      // Update version
      source._version = 2;
      
      // Should find the existing dependency
      helpers.link(source, target, 2);
      
      expect(existingNode.fromVersion).toBe(2);
      expect(target._in).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _version: 1,
        _outTail: undefined,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _gen: 0,
        _inTail: undefined,
      };
      
      helpers.link(source, target, 1);
      
      expect(source._out).toBeDefined();
      expect(target._in).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, (_, i) => ({
        __type: 'test',
        _out: undefined,
        _version: i + 1,
      }));
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _gen: 0,
        _inTail: undefined,
      };
      
      // Add dependencies from multiple sources
      sources.forEach(source => {
        helpers.link(source as ProducerNode, target, (source as ProducerNode)._version);
      });
      
      // Count sources
      let count = 0;
      let node = target._in;
      while (node) {
        count++;
        node = node.nextIn;
      }
      
      expect(count).toBe(3);
    });

    it('should update version when dependency already exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _version: 1,
        _outTail: undefined,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _invalidate: () => {},
        _updateValue: () => true,
        _gen: 0,
        _inTail: undefined,
      };
      
      // Create initial dependency
      helpers.link(source, target, 1);
      
      // Update version
      source._version = 5;
      
      // Update dependency
      helpers.link(source, target, 5);
      
      // Check that version was updated
      const node = target._in;
      expect(node?.fromVersion).toBe(5);
    });
  });

  describe('link edge creation', () => {
      it('should create bidirectional links between source and target', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _version: 1,
          _outTail: undefined,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined,
        };
        
        helpers.link(source, target, 1);
        const node = target._in!;
        
        expect(node.from).toBe(source);
        expect(node.to).toBe(target);
        expect(node.fromVersion).toBe(1);
        expect(source._out).toBe(node);
        expect(target._in).toBe(node);
      });
  
      it('should maintain linked lists when multiple dependencies exist', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _version: 1,
          _outTail: undefined,
        };
        
        const target1: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined,
        };
        
        const target2: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined,
        };
        
        helpers.link(source, target1, 1);
        const node1 = target1._in!;
        helpers.link(source, target2, 1);
        const node2 = target2._in!;
        
        // Source should point to first target (head of list)
        expect(source._out).toBe(node1);
        // node1 should point to node2 (insertion order)
        expect(node1.nextOut).toBe(node2);
        expect(node2.prevOut).toBe(node1);
        // node2 should be the tail
        expect(source._outTail).toBe(node2);
      });
  
      it('should set TRACKING flag for computed sources', () => {
        const source = {
          __type: 'test',
          _out: undefined,
          _lastEdge: undefined,
          _version: 1,
          _flags: 0,
          _outTail: undefined
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined,
        };
        
        helpers.link(source, target, 1);
        
        // TRACKING flag is 1 << 4 = 16
        expect(source._flags & 16).toBe(16);
      });
    });
  
    describe('unlinkFromProducer', () => {
      it('should remove node from targets list', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _version: 1,
          _outTail: undefined,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined,
        };
        
        helpers.link(source, target, 1);
        const node = target._in!;
        
        helpers.unlinkFromProducer(node);
        
        expect(source._out).toBeUndefined();
      });
  
      it('should maintain linked list integrity when removing middle node', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _version: 1,
          _outTail: undefined,
        };
        
        const targets = Array.from({ length: 3 }, () => ({
          __type: 'test',
          _in: undefined,
          _invalidate: () => {},
        }) as ConsumerNode);
        
        targets.forEach(target => helpers.link(source, target, 1));
        const nodes = targets.map(target => target._in!);
        
        // Remove middle node
        helpers.unlinkFromProducer(nodes[1]!);
        
        // Check that nodes[0] and nodes[2] are still linked in correct order
        expect(nodes[0]!.nextOut).toBe(nodes[2]);
        expect(nodes[2]!.prevOut).toBe(nodes[0]);
      });
  
      it('should clear TRACKING flag when last target is removed', () => {
        const source = {
          __type: 'test',
          _out: undefined,
          _version: 1,
          _flags: 16, // TRACKING flag set
          _outTail: undefined,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _invalidate: () => {},
          _updateValue: () => true,
          _gen: 0,
          _inTail: undefined
        };
        
        helpers.link(source, target, 1);
        const node = target._in!;
        
        helpers.unlinkFromProducer(node);
        
        expect(source._flags & 16).toBe(0);
      });
    });
});

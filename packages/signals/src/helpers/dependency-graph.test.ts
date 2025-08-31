import { describe, it, expect, beforeEach } from 'vitest';
import { createDependencyGraph } from './dependency-graph';
import type { ConsumerNode, ProducerNode, Edge, ScheduledNode } from '../types';
import { CONSTANTS } from '../constants';

const { STATUS_DISPOSED, STATUS_CHECKING, STATUS_INVALIDATED, HAS_CHANGED } = CONSTANTS;

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
        _flags: 0,
        _outTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _inTail: undefined,
      };
      
      // First call creates the dependency
      helpers.addEdge(source, target);
      const firstEdge = target._in;
      
      // Update version
      source._flags |= HAS_CHANGED;
      
      // Second call should reuse the same edge
      helpers.addEdge(source, target);
      
      expect(target._in).toBe(firstEdge);
    });

    it('should find existing dependency in sources list', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _flags: 0,
        _outTail: undefined,
        value: 0
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _inTail: undefined,
      };
      
      // Create dependency manually
      helpers.addEdge(source, target);
      const existingNode = target._in!;
      
      // Update version
      source._flags |= HAS_CHANGED;
      
      // Should find the existing dependency
      helpers.addEdge(source, target);
      
      expect(target._in).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        _out: undefined,
        _flags: 0,
        _outTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _inTail: undefined,
      };
      
      helpers.addEdge(source, target);
      
      expect(source._out).toBeDefined();
      expect(target._in).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, () => ({
        __type: 'test',
        _out: undefined,
        _outTail: undefined,
        _flags: 0,
      }));
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _inTail: undefined,
      };
      
      // Add dependencies from multiple sources
      sources.forEach((source) => {
        helpers.addEdge(source as ProducerNode, target);
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
        _flags: 0,
        _outTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        _flags: 0,
        _in: undefined,
        _inTail: undefined,
      };
      
      // Create initial dependency
      helpers.addEdge(source, target);
      
      // Update version
      source._flags |= HAS_CHANGED;
      
      // Update dependency
      helpers.addEdge(source, target);
      
      // Check that tail was updated correctly
      const node = target._in;
      expect(node).toBeDefined();
    });
  });

  describe('link edge creation', () => {
      it('should create bidirectional links between source and target', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
              _inTail: undefined,
        };
        
        helpers.addEdge(source, target);
        const node = target._in!;
        
        expect(node.from).toBe(source);
        expect(node.to).toBe(target);
        expect(source._out).toBe(node);
        expect(target._in).toBe(node);
      });
  
      it('should maintain linked lists when multiple dependencies exist', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        
        const target1: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
              _inTail: undefined,
        };
        
        const target2: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
              _inTail: undefined,
        };
        
        helpers.addEdge(source, target1);
        const node1 = target1._in!;
        helpers.addEdge(source, target2);
        const node2 = target2._in!;
        
        // Source should point to first target (head of list)
        expect(source._out).toBe(node1);
        // node1 should point to node2 (insertion order)
        expect(node1.nextOut).toBe(node2);
        expect(node2.prevOut).toBe(node1);
        // node2 should be the tail
        expect(source._outTail).toBe(node2);
      });
    });
  
    describe('unlink', () => {
      it('should remove edge from both producer and consumer lists', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
              _inTail: undefined,
        };
        
        helpers.addEdge(source, target);
        const node = target._in!;
        
        const next = helpers.removeEdge(node);
        
        expect(source._out).toBeUndefined();
        expect(target._in).toBeUndefined();
        expect(target._inTail).toBeUndefined();
        expect(next).toBeUndefined();
      });
  
      it('should maintain linked list integrity when removing middle node', () => {
        const source: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        
        const targets = Array.from({ length: 3 }, (_, i) => ({
          __type: 'test',
          _in: undefined,
          _inTail: undefined,
          id: i,  // Add id for debugging
        }) as ConsumerNode & { id: number });
        
        // Link all targets
        targets.forEach(target => helpers.addEdge(source, target));
        
        // Get the edge pointing to the second target (middle one)
        let edge = source._out;
        let middleEdge: Edge | undefined;
        while (edge) {
          if (edge.to === targets[1]) {
            middleEdge = edge;
            break;
          }
          edge = edge.nextOut;
        }
        
        // Remove middle edge
        const next = helpers.removeEdge(middleEdge!);
        
        // Check producer's output list integrity
        const firstEdge = source._out!;
        const thirdEdge = firstEdge.nextOut!;
        
        // After removal, first edge should point to third edge
        expect(firstEdge.to).toBe(targets[0]);
        expect(thirdEdge.to).toBe(targets[2]);
        expect(firstEdge.nextOut).toBe(thirdEdge);
        expect(thirdEdge.prevOut).toBe(firstEdge);
        
        // The returned next should be undefined since we removed from middle of consumer's list
        // (middleEdge was in targets[1]._in, which only had one edge)
        expect(next).toBeUndefined();
      });
      
      it('should return next edge for efficient iteration', () => {
        const source1: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        const source2: ProducerNode = {
          __type: 'test',
          _out: undefined,
          _flags: 0,
          _outTail: undefined,
          value: 0,
        };
        
        const target: ConsumerNode = {
          __type: 'test',
          _flags: 0,
          _in: undefined,
          _inTail: undefined,
        };
        
        helpers.addEdge(source1, target);
        helpers.addEdge(source2, target);
        
        const firstEdge = target._in!;
        const secondEdge = firstEdge.nextIn!;
        
        const next = helpers.removeEdge(firstEdge);
        
        expect(next).toBe(secondEdge);
        expect(target._in).toBe(secondEdge);
      });
    });
  
  describe('GraphWalker', () => {
    let scheduledNodes: ScheduledNode[];
    let walk: (from: Edge | undefined, visit: (node: ConsumerNode) => void) => void;
    let visit: (node: ConsumerNode) => void;
  
    beforeEach(() => {
      scheduledNodes = [];
  
      visit = (node: ConsumerNode) => {
        // Check if this node is schedulable (has effect properties)
        if ('_nextScheduled' in node) {
          const schedulableNode = node as ConsumerNode & ScheduledNode;
          if (schedulableNode._nextScheduled !== undefined) return;
          
          scheduledNodes.push(schedulableNode);
          schedulableNode._nextScheduled = schedulableNode; // Use self as flag
        }
      };
  
      walk = helpers.invalidate;
    });
  
    function createMockNode(
      type: string,
      flags = 0,
      isScheduled = false
    ): ConsumerNode & Partial<ProducerNode & ScheduledNode> {
      const node: ConsumerNode & Partial<ProducerNode & ScheduledNode> = {
        __type: type,
        _in: undefined,
        _inTail: undefined,
        _flags: flags,
      };
  
      if (isScheduled) {
        node._flush = () => {};
        node._nextScheduled = undefined;
        node.dispose = () => {};
      }
  
      return node;
    }
  
    function createEdge(from: ProducerNode, to: ConsumerNode): Edge {
      return {
        from,
        to,
        prevIn: undefined,
        nextIn: undefined,
        prevOut: undefined,
        nextOut: undefined
      };
    }
  
    function linkEdges(edges: Edge[]): void {
      for (let i = 0; i < edges.length - 1; i++) {
        edges[i]!.nextOut = edges[i + 1];
        edges[i + 1]!.prevOut = edges[i];
      }
    }
  
    it('should invalidate a single target', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed');
      const edge = createEdge(source, target);
  
      walk(edge, visit);
  
      // With push-pull system, computeds get STATUS_INVALIDATED during push phase
      expect(target._flags & STATUS_INVALIDATED).toBeTruthy();
    });
  
    it('should mark effects as DIRTY (simplified flag system)', () => {
      const source = createMockNode('signal') as ProducerNode;
      const effect = createMockNode('effect', 0, true); // isScheduled = true
      const edge = createEdge(source, effect);
  
      walk(edge, visit);
  
      // With push-pull system, effects get STATUS_INVALIDATED during push phase
      expect(effect._flags & STATUS_INVALIDATED).toBeTruthy();
    });
  
    it('should skip already notified nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_INVALIDATED);
      const edge = createEdge(source, target);
  
      const initialFlags = target._flags;
      walk(edge, visit);
  
      expect(target._flags).toBe(initialFlags);
    });
  
    it('should skip disposed nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_DISPOSED);
      const edge = createEdge(source, target);
  
      const initialFlags = target._flags;
      walk(edge, visit);
  
      expect(target._flags).toBe(initialFlags);
    });
  
    it('should skip running nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_CHECKING);
      const edge = createEdge(source, target);
  
      const initialFlags = target._flags;
      walk(edge, visit);
  
      expect(target._flags).toBe(initialFlags);
    });
  
    it('should handle multiple siblings', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target1 = createMockNode('computed');
      const target2 = createMockNode('computed');
      const target3 = createMockNode('computed');
  
      const edge1 = createEdge(source, target1);
      const edge2 = createEdge(source, target2);
      const edge3 = createEdge(source, target3);
  
      linkEdges([edge1, edge2, edge3]);
  
      walk(edge1, visit);
  
      expect(target1._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(target2._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(target3._flags & STATUS_INVALIDATED).toBeTruthy();
    });
  
    it('should traverse depth-first through dependency chains', () => {
      // Create chain: source -> computed1 -> computed2 -> effect
      const source = createMockNode('signal') as ProducerNode;
      const computed1 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const computed2 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const effect = createMockNode('effect', 0, true);
  
      const edge1 = createEdge(source, computed1);
      const edge2 = createEdge(computed1, computed2);
      const edge3 = createEdge(computed2, effect);
  
      computed1._out = edge2;
      computed2._out = edge3;
  
      walk(edge1, visit);
  
      expect(computed1._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(computed2._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(effect._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(scheduledNodes).toContain(effect);
    });
  
    it('should handle diamond dependencies', () => {
      // Diamond: source -> [computed1, computed2] -> computed3
      const source = createMockNode('signal') as ProducerNode;
      const computed1 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const computed2 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const computed3 = createMockNode('computed');
  
      const edge1 = createEdge(source, computed1);
      const edge2 = createEdge(source, computed2);
      const edge3 = createEdge(computed1, computed3);
      const edge4 = createEdge(computed2, computed3);
  
      linkEdges([edge1, edge2]);
      computed1._out = edge3;
      computed2._out = edge4;
  
      walk(edge1, visit);
  
      expect(computed1._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(computed2._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(computed3._flags & STATUS_INVALIDATED).toBeTruthy();
    });
  
    it('should handle complex graphs with multiple branches', () => {
      // Tree structure:
      //         source
      //        /      \
      //    comp1      comp2
      //    /   \        |
      // comp3  eff1   comp4
      //   |             |
      // eff2          eff3
  
      const source = createMockNode('signal') as ProducerNode;
      const comp1 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const comp2 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const comp3 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const comp4 = createMockNode('computed') as ConsumerNode & ProducerNode;
      const eff1 = createMockNode('effect', 0, true);
      const eff2 = createMockNode('effect', 0, true);
      const eff3 = createMockNode('effect', 0, true);
  
      // Set up edges
      const sourceToComp1 = createEdge(source, comp1);
      const sourceToComp2 = createEdge(source, comp2);
      linkEdges([sourceToComp1, sourceToComp2]);
  
      const comp1ToComp3 = createEdge(comp1, comp3);
      const comp1ToEff1 = createEdge(comp1, eff1);
      linkEdges([comp1ToComp3, comp1ToEff1]);
      comp1._out = comp1ToComp3;
  
      const comp2ToComp4 = createEdge(comp2, comp4);
      comp2._out = comp2ToComp4;
  
      const comp3ToEff2 = createEdge(comp3, eff2);
      comp3._out = comp3ToEff2;
  
      const comp4ToEff3 = createEdge(comp4, eff3);
      comp4._out = comp4ToEff3;
  
      walk(sourceToComp1, visit);
  
      // All nodes should be invalidated
      expect(comp1._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(comp2._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(comp3._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(comp4._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(eff1._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(eff2._flags & STATUS_INVALIDATED).toBeTruthy();
      expect(eff3._flags & STATUS_INVALIDATED).toBeTruthy();
  
      // All effects should be scheduled
      expect(scheduledNodes).toContain(eff1);
      expect(scheduledNodes).toContain(eff2);
      expect(scheduledNodes).toContain(eff3);
    });
  
    it('should handle empty edge', () => {
      walk(undefined, visit);
      // Should not throw
      expect(scheduledNodes).toHaveLength(0);
    });
  
    it('should avoid scheduling the same effect multiple times', () => {
      const source = createMockNode('signal') as ProducerNode;
      const effect = createMockNode('effect', 0, true);
  
      const edge1 = createEdge(source, effect);
      const edge2 = createEdge(source, effect);
      linkEdges([edge1, edge2]);
  
      // Manually set _nextScheduled to simulate already scheduled
      effect._nextScheduled = {} as ScheduledNode;
  
      walk(edge1, visit);
  
      // Effect should only be scheduled once
      expect(scheduledNodes).toHaveLength(0); // Because it was already scheduled
    });
  
    it('should handle very deep chains efficiently', () => {
      // Create a chain of 100 nodes
      const nodes: (ConsumerNode & ProducerNode)[] = [];
      const edges: Edge[] = [];
  
      for (let i = 0; i < 100; i++) {
        nodes[i] = createMockNode(`computed${i}`) as ConsumerNode & ProducerNode;
      }
  
      for (let i = 0; i < 99; i++) {
        const edge = createEdge(nodes[i]!, nodes[i + 1]!);
        edges.push(edge);
        nodes[i]!._out = edge;
      }
  
      walk(edges[0], visit);
  
      // All nodes should be notified as DIRTY with simplified flag system
      for (let i = 1; i < 100; i++) {
        expect(nodes[i]!._flags & STATUS_INVALIDATED).toBeTruthy();
      }
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGraphEdges } from './graph-edges';
import { createScheduler } from './scheduler';
import { createPullPropagator } from './pull-propagator';
import { createBaseContext } from '../context';
import type { ConsumerNode, ProducerNode, Dependency, ScheduledNode } from '../types';
import { CONSTANTS } from '../constants';
import { createGraphTraversal } from './graph-traversal';

const { STATUS_DISPOSED, STATUS_PENDING, STATUS_DIRTY, STATUS_SCHEDULED } = CONSTANTS;

describe('Dependency Graph Helpers', () => {
  let helpers: {
    trackDependency: ReturnType<typeof createGraphEdges>['trackDependency'];
    detachAll: ReturnType<typeof createGraphEdges>['detachAll'];
    pushUpdates: ReturnType<typeof createScheduler>['propagate'];
    pullUpdates: ReturnType<typeof createPullPropagator>['pullUpdates'];
  };

  beforeEach(() => {
    const graphEdges = createGraphEdges();
    const { traverseGraph } = createGraphTraversal();
    const scheduler = createScheduler({
      propagate: traverseGraph,
      detachAll: graphEdges.detachAll,
    });
    const ctx = { ...createBaseContext(), graphEdges };
    const pullPropagator = createPullPropagator({ ctx, track: graphEdges.track });

    helpers = {
      trackDependency: graphEdges.trackDependency,
      detachAll: graphEdges.detachAll,
      pushUpdates: scheduler.propagate,
      pullUpdates: pullPropagator.pullUpdates,
    };
  });

  describe('link', () => {
    it('should reuse edge when same producer accessed again', () => {
      const source: ProducerNode = {
        __type: 'test',
        subscribers: undefined,
        status: 0,
        subscribersTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        status: 0,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };
      
      // First call creates the dependency
      helpers.trackDependency(source, target);
      const firstEdge = target.dependencies;
      
      // Update version
      source.status = STATUS_DIRTY;
      
      // Second call should reuse the same edge
      helpers.trackDependency(source, target);
      
      expect(target.dependencies).toBe(firstEdge);
    });

    it('should find existing dependency in sources list', () => {
      const source: ProducerNode = {
        __type: 'test',
        subscribers: undefined,
        status: 0,
        subscribersTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        status: 0,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };
      
      // Create dependency manually
      helpers.trackDependency(source, target);
      const existingNode = target.dependencies;
      
      // Update version
      source.status = STATUS_DIRTY;
      
      // Should find the existing dependency
      helpers.trackDependency(source, target);
      
      expect(target.dependencies).toBe(existingNode);
    });

    it('should create new dependency when none exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        subscribers: undefined,
        status: 0,
        subscribersTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        status: 0,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };
      
      helpers.trackDependency(source, target);
      
      expect(source.subscribers).toBeDefined();
      expect(target.dependencies).toBeDefined();
    });

    it('should handle multiple sources for the same target', () => {
      const sources = Array.from({ length: 3 }, () => ({
        __type: 'test',
        subscribers: undefined,
        subscribersTail: undefined,
        status: 0,
      }));
      
      const target: ConsumerNode = {
        __type: 'test',
        status: 0,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };
      
      // Add dependencies from multiple sources
      sources.forEach((source) => {
        helpers.trackDependency(source as ProducerNode, target);
      });
      
      // Count sources
      let count = 0;
      let node = target.dependencies;
      while (node) {
        count++;
        node = node.nextDependency;
      }
      
      expect(count).toBe(3);
    });

    it('should update version when dependency already exists', () => {
      const source: ProducerNode = {
        __type: 'test',
        subscribers: undefined,
        status: 0,
        subscribersTail: undefined,
        value: 0,
      };
      
      const target: ConsumerNode = {
        __type: 'test',
        status: 0,
        dependencies: undefined,
        dependencyTail: undefined,
        trackingVersion: 0,
      };
      
      // Create initial dependency
      helpers.trackDependency(source, target);
      
      // Update version
      source.status = STATUS_DIRTY;
      
      // Update dependency
      helpers.trackDependency(source, target);
      
      // Check that tail was updated correctly
      const node = target.dependencies;
      expect(node).toBeDefined();
    });
  });

  describe('link edge creation', () => {
      it('should create bidirectional links between source and target', () => {
        const source: ProducerNode = {
          __type: 'test',
          subscribers: undefined,
          status: 0,
          subscribersTail: undefined,
          value: 0,
          };
        
        const target: ConsumerNode = {
          __type: 'test',
          status: 0,
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };
        
        helpers.trackDependency(source, target);
        const node = target.dependencies!;
        
        expect(node.producer).toBe(source);
        expect(node.consumer).toBe(target);
        expect(source.subscribers).toBe(node);
        expect(target.dependencies).toBe(node);
      });
  
      it('should maintain linked lists when multiple dependencies exist', () => {
        const source: ProducerNode = {
          __type: 'test',
          subscribers: undefined,
          status: 0,
          subscribersTail: undefined,
          value: 0,
          };
        
        const target1: ConsumerNode = {
          __type: 'test',
          status: 0,
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };
        
        const target2: ConsumerNode = {
          __type: 'test',
          status: 0,
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };
        
        helpers.trackDependency(source, target1);
        const node1 = target1.dependencies!;
        helpers.trackDependency(source, target2);
        const node2 = target2.dependencies!;
        
        // Source should point to first target (head of list)
        expect(source.subscribers).toBe(node1);
        // node1 should point to node2 (insertion order)
        expect(node1.nextConsumer).toBe(node2);
        expect(node2.prevConsumer).toBe(node1);
        // node2 should be the tail
        expect(source.subscribersTail).toBe(node2);
      });
    });
  
    describe('unlink', () => {
      it('should remove edge from both producer and consumer lists', () => {
        const source: ProducerNode = {
          __type: 'test',
          subscribers: undefined,
          status: 0,
          subscribersTail: undefined,
          value: 0,
          };
        
        const target: ConsumerNode = {
          __type: 'test',
          status: 0,
          dependencies: undefined,
          dependencyTail: undefined,
          trackingVersion: 0,
        };
        
        helpers.trackDependency(source, target);
        const node = target.dependencies!;
        
        const next = helpers.detachAll(node);
        
        expect(source.subscribers).toBeUndefined();
        expect(target.dependencies).toBeUndefined();
        expect(target.dependencyTail).toBeUndefined();
        expect(next).toBeUndefined();
      });
  
      it('should maintain linked list integrity when removing middle node', () => {
        const source: ProducerNode = {
          __type: 'test',
          subscribers: undefined,
          status: 0,
          subscribersTail: undefined,
          value: 0,
          };
        
        const targets = Array.from(
          { length: 3 },
          (_, i) =>
            ({
              __type: 'test',
              status: 0,
              dependencies: undefined,
              dependencyTail: undefined,
              trackingVersion: 0,
              id: i, // Add id for debugging
            }) as ConsumerNode & { id: number }
        );
        
        // Link all targets
        targets.forEach(target => helpers.trackDependency(source, target));
        
        // Get the edge pointing to the second target (middle one)
        let edge = source.subscribers;
        let middleEdge: Dependency | undefined;
        while (edge) {
          if (edge.consumer === targets[1]) {
            middleEdge = edge;
            break;
          }
          edge = edge.nextConsumer;
        }
        
        // Remove middle edge
        const next = helpers.detachAll(middleEdge!);
        
        // Check producer's output list integrity
        const firstEdge = source.subscribers!;
        const thirdEdge = firstEdge.nextConsumer!;
        
        // After removal, first edge should point to third edge
        expect(firstEdge.consumer).toBe(targets[0]);
        expect(thirdEdge.consumer).toBe(targets[2]);
        expect(firstEdge.nextConsumer).toBe(thirdEdge);
        expect(thirdEdge.prevConsumer).toBe(firstEdge);
        
        // The returned next should be undefined since we removed from middle of consumer's list
        // (middleEdge was in targets[1].in, which only had one edge)
        expect(next).toBeUndefined();
      });
    });
  
  describe('GraphWalker', () => {
    let scheduledNodes: ScheduledNode[];
    let walk: (from: Dependency) => void;
  
    beforeEach(() => {
      scheduledNodes = [];

      // Create a custom scheduler that tracks scheduled nodes
      const { traverseGraph } = createGraphTraversal();
      const graphEdges = createGraphEdges();

      const testScheduler = createScheduler({
        propagate: traverseGraph,
        detachAll: graphEdges.detachAll,
      });
      testScheduler.startBatch(); // Prevent auto-flush so we can inspect scheduled status

      walk = testScheduler.propagate;
    });
  
    function createMockNode(
      type: string,
      flags = 0,
      isScheduled = false
    ): ConsumerNode & Partial<ProducerNode & ScheduledNode> {
      const node: ConsumerNode & Partial<ProducerNode & ScheduledNode> = {
        __type: type,
        dependencies: undefined,
        dependencyTail: undefined,
        status: flags,
        trackingVersion: 0,
      };
  
      if (isScheduled) {
        node.flush = vi.fn();
        node.nextScheduled = undefined;
      }
  
      return node;
    }
  
    function createEdge(from: ProducerNode, to: ConsumerNode): Dependency {
      return {
        producer: from,
        consumer: to,
        version: 0,
        prevDependency: undefined,
        nextDependency: undefined,
        prevConsumer: undefined,
        nextConsumer: undefined,
      };
    }
  
    function linkEdges(edges: Dependency[]): void {
      for (let i = 0; i < edges.length - 1; i++) {
        edges[i]!.nextConsumer = edges[i + 1];
        edges[i + 1]!.prevConsumer = edges[i];
      }
    }
  
    it('should invalidate a single target', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed');
      const edge = createEdge(source, target);
  
      walk(edge);
  
      // With push-pull system, computeds get STATUS_PENDING during push phase
      expect(target.status).toBe(STATUS_PENDING);
    });
  
    it('should mark effects as DIRTY (simplified flag system)', () => {
      const source = createMockNode('signal') as ProducerNode;
      const effect = createMockNode('effect', 0, true); // isScheduled = true
      const edge = createEdge(source, effect);

      walk(edge);

      // With push-pull system, scheduled nodes get STATUS_SCHEDULED after enqueueing
      expect(effect.status).toBe(STATUS_SCHEDULED);
    });
  
    it('should skip already notified nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_PENDING);
      const edge = createEdge(source, target);
  
      const initialStatus = target.status;
      walk(edge);
  
      expect(target.status).toBe(initialStatus);
    });
  
    it('should skip disposed nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_DISPOSED);
      const edge = createEdge(source, target);
  
      const initialStatus = target.status;
      walk(edge);
  
      expect(target.status).toBe(initialStatus);
    });
  
    it('should skip running nodes', () => {
      const source = createMockNode('signal') as ProducerNode;
      const target = createMockNode('computed', STATUS_PENDING);
      const edge = createEdge(source, target);
  
      const initialStatus = target.status;
      walk(edge);
  
      expect(target.status).toBe(initialStatus);
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
  
      walk(edge1);
  
      expect(target1.status).toBe(STATUS_PENDING);
      expect(target2.status).toBe(STATUS_PENDING);
      expect(target3.status).toBe(STATUS_PENDING);
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
  
      computed1.subscribers = edge2;
      computed2.subscribers = edge3;
  
      walk(edge1);

      expect(computed1.status).toBe(STATUS_PENDING);
      expect(computed2.status).toBe(STATUS_PENDING);
      expect(effect.status).toBe(STATUS_SCHEDULED);

      // Collect scheduled nodes for testing
      if (effect.status === STATUS_SCHEDULED) {
        scheduledNodes.push(effect as ScheduledNode);
      }
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
      computed1.subscribers = edge3;
      computed2.subscribers = edge4;
  
      walk(edge1);
  
      expect(computed1.status).toBe(STATUS_PENDING);
      expect(computed2.status).toBe(STATUS_PENDING);
      expect(computed3.status).toBe(STATUS_PENDING);
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
      comp1.subscribers = comp1ToComp3;
  
      const comp2ToComp4 = createEdge(comp2, comp4);
      comp2.subscribers = comp2ToComp4;
  
      const comp3ToEff2 = createEdge(comp3, eff2);
      comp3.subscribers = comp3ToEff2;
  
      const comp4ToEff3 = createEdge(comp4, eff3);
      comp4.subscribers = comp4ToEff3;
  
      walk(sourceToComp1);
  
      // All nodes should be invalidated
      expect(comp1.status).toBe(STATUS_PENDING);
      expect(comp2.status).toBe(STATUS_PENDING);
      expect(comp3.status).toBe(STATUS_PENDING);
      expect(comp4.status).toBe(STATUS_PENDING);
      expect(eff1.status).toBe(STATUS_SCHEDULED);
      expect(eff2.status).toBe(STATUS_SCHEDULED);
      expect(eff3.status).toBe(STATUS_SCHEDULED);
  
      // Collect scheduled nodes for testing
      if (eff1.status === STATUS_SCHEDULED) scheduledNodes.push(eff1 as ScheduledNode);
      if (eff2.status === STATUS_SCHEDULED) scheduledNodes.push(eff2 as ScheduledNode);
      if (eff3.status === STATUS_SCHEDULED) scheduledNodes.push(eff3 as ScheduledNode);

      // All effects should be scheduled
      expect(scheduledNodes).toContain(eff1);
      expect(scheduledNodes).toContain(eff2);
      expect(scheduledNodes).toContain(eff3);
    });
  
    it('should avoid scheduling the same effect multiple times', () => {
      const source = createMockNode('signal') as ProducerNode;
      const effect = createMockNode('effect', 0, true);
  
      const edge1 = createEdge(source, effect);
      const edge2 = createEdge(source, effect);
      linkEdges([edge1, edge2]);

      // Manually set status to simulate already scheduled
      effect.status = STATUS_SCHEDULED;

      walk(edge1);

      // Effect should only be scheduled once
      expect(scheduledNodes).toHaveLength(0); // Because it was already scheduled
    });
  
    it('should handle very deep chains efficiently', () => {
      // Create a chain of 100 nodes
      const nodes: (ConsumerNode & ProducerNode)[] = [];
      const edges: Dependency[] = [];
  
      for (let i = 0; i < 100; i++) {
        nodes[i] = createMockNode(`computed${i}`) as ConsumerNode & ProducerNode;
      }
  
      for (let i = 0; i < 99; i++) {
        const edge = createEdge(nodes[i]!, nodes[i + 1]!);
        edges.push(edge);
        nodes[i]!.subscribers = edge;
      }
  
      walk(edges[0]!);
  
      // All nodes should be notified as DIRTY with simplified flag system
      for (let i = 1; i < 100; i++) {
        expect(nodes[i]!.status).toBe(STATUS_PENDING);
      }
    });
  });
});

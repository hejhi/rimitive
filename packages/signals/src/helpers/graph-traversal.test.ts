import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphTraversalHelpers } from './graph-traversal';
import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode, StatefulNode, ProducerNode, ScheduledNode } from '../types';
import type { SignalContext } from '../context';

const { NOTIFIED, OUTDATED, DISPOSED, RUNNING } = CONSTANTS;

describe('createGraphTraversalHelpers', () => {
  let ctx: SignalContext;
  let scheduledNodes: ScheduledNode[];
  let scheduleConsumer: (node: ScheduledNode) => void;
  let traverseAndInvalidate: (startEdge: Edge | undefined) => void;

  beforeEach(() => {
    scheduledNodes = [];
    ctx = {
      currentConsumer: null,
      batchDepth: 0,
      scheduledQueue: new Array(256),
      scheduledHead: 0,
      scheduledTail: 0,
      scheduledMask: 255,
      version: 0,
      nodePool: [],
      poolSize: 0,
      allocations: 0,
    };

    scheduleConsumer = (node: ScheduledNode) => {
      // Mimic the real scheduleConsumer behavior - check _nextScheduled
      if (node._nextScheduled !== undefined) return;
      
      scheduledNodes.push(node);
      node._nextScheduled = node; // Use self as flag
    };

    const helpers = createGraphTraversalHelpers(ctx, { 
      scheduleConsumer,
      invalidateConsumer: () => {},
      disposeConsumer: () => {},
      flushScheduled: () => {}
    });
    
    traverseAndInvalidate = helpers.traverseAndInvalidate;
  });

  function createMockNode(
    type: string,
    flags = 0,
    isScheduled = false
  ): ConsumerNode & StatefulNode & Partial<ProducerNode & ScheduledNode> {
    const node: ConsumerNode & StatefulNode & Partial<ProducerNode & ScheduledNode> = {
      __type: type,
      _sources: undefined,
      _flags: flags,
      _invalidate: () => {},
    };

    if (isScheduled) {
      node._flush = () => {};
      node._nextScheduled = undefined;
      node.dispose = () => {};
    }

    return node;
  }

  function createEdge(
    source: ProducerNode,
    target: ConsumerNode
  ): Edge {
    return {
      source,
      target,
      version: 0,
      prevSource: undefined,
      nextSource: undefined,
      prevTarget: undefined,
      nextTarget: undefined,
    };
  }

  function linkEdges(edges: Edge[]): void {
    for (let i = 0; i < edges.length - 1; i++) {
      edges[i]!.nextTarget = edges[i + 1];
      edges[i + 1]!.prevTarget = edges[i];
    }
  }

  it('should invalidate a single target', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed');
    const edge = createEdge(source, target);

    traverseAndInvalidate(edge);

    // With push-pull optimization, computeds only get NOTIFIED, not OUTDATED
    expect(target._flags & NOTIFIED).toBeTruthy();
    expect(target._flags & OUTDATED).toBeFalsy();
  });

  it('should mark effects as both NOTIFIED and OUTDATED', () => {
    const source = createMockNode('signal') as ProducerNode;
    const effect = createMockNode('effect', 0, true); // isScheduled = true
    const edge = createEdge(source, effect);

    traverseAndInvalidate(edge);

    // Effects should be marked as both NOTIFIED and OUTDATED
    expect(effect._flags & NOTIFIED).toBeTruthy();
    expect(effect._flags & OUTDATED).toBeTruthy();
  });

  it('should skip already notified nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', NOTIFIED);
    const edge = createEdge(source, target);

    const initialFlags = target._flags;
    traverseAndInvalidate(edge);

    expect(target._flags).toBe(initialFlags);
  });

  it('should skip disposed nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', DISPOSED);
    const edge = createEdge(source, target);

    const initialFlags = target._flags;
    traverseAndInvalidate(edge);

    expect(target._flags).toBe(initialFlags);
  });

  it('should skip running nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', RUNNING);
    const edge = createEdge(source, target);

    const initialFlags = target._flags;
    traverseAndInvalidate(edge);

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

    traverseAndInvalidate(edge1);

    expect(target1._flags & NOTIFIED).toBeTruthy();
    expect(target2._flags & NOTIFIED).toBeTruthy();
    expect(target3._flags & NOTIFIED).toBeTruthy();
  });

  it('should traverse depth-first through dependency chains', () => {
    // Create chain: source -> computed1 -> computed2 -> effect
    const source = createMockNode('signal') as ProducerNode;
    const computed1 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const computed2 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const effect = createMockNode('effect', 0, true);

    const edge1 = createEdge(source, computed1);
    const edge2 = createEdge(computed1, computed2);
    const edge3 = createEdge(computed2, effect);

    computed1._targets = edge2;
    computed2._targets = edge3;

    traverseAndInvalidate(edge1);

    expect(computed1._flags & NOTIFIED).toBeTruthy();
    expect(computed2._flags & NOTIFIED).toBeTruthy();
    expect(effect._flags & NOTIFIED).toBeTruthy();
    expect(scheduledNodes).toContain(effect);
  });

  it('should handle diamond dependencies', () => {
    // Diamond: source -> [computed1, computed2] -> computed3
    const source = createMockNode('signal') as ProducerNode;
    const computed1 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const computed2 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const computed3 = createMockNode('computed');

    const edge1 = createEdge(source, computed1);
    const edge2 = createEdge(source, computed2);
    const edge3 = createEdge(computed1, computed3);
    const edge4 = createEdge(computed2, computed3);

    linkEdges([edge1, edge2]);
    computed1._targets = edge3;
    computed2._targets = edge4;

    traverseAndInvalidate(edge1);

    expect(computed1._flags & NOTIFIED).toBeTruthy();
    expect(computed2._flags & NOTIFIED).toBeTruthy();
    expect(computed3._flags & NOTIFIED).toBeTruthy();
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
    const comp1 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const comp2 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const comp3 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
    const comp4 = createMockNode('computed') as ConsumerNode & StatefulNode & ProducerNode;
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
    comp1._targets = comp1ToComp3;

    const comp2ToComp4 = createEdge(comp2, comp4);
    comp2._targets = comp2ToComp4;

    const comp3ToEff2 = createEdge(comp3, eff2);
    comp3._targets = comp3ToEff2;

    const comp4ToEff3 = createEdge(comp4, eff3);
    comp4._targets = comp4ToEff3;

    traverseAndInvalidate(sourceToComp1);

    // All nodes should be invalidated
    expect(comp1._flags & NOTIFIED).toBeTruthy();
    expect(comp2._flags & NOTIFIED).toBeTruthy();
    expect(comp3._flags & NOTIFIED).toBeTruthy();
    expect(comp4._flags & NOTIFIED).toBeTruthy();
    expect(eff1._flags & NOTIFIED).toBeTruthy();
    expect(eff2._flags & NOTIFIED).toBeTruthy();
    expect(eff3._flags & NOTIFIED).toBeTruthy();

    // All effects should be scheduled
    expect(scheduledNodes).toContain(eff1);
    expect(scheduledNodes).toContain(eff2);
    expect(scheduledNodes).toContain(eff3);
  });

  it('should handle empty edge', () => {
    traverseAndInvalidate(undefined);
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

    traverseAndInvalidate(edge1);

    // Effect should only be scheduled once
    expect(scheduledNodes).toHaveLength(0); // Because it was already scheduled
  });

  it('should handle very deep chains efficiently', () => {
    // Create a chain of 100 nodes
    const nodes: (ConsumerNode & StatefulNode & ProducerNode)[] = [];
    const edges: Edge[] = [];

    for (let i = 0; i < 100; i++) {
      nodes[i] = createMockNode(`computed${i}`) as ConsumerNode & StatefulNode & ProducerNode;
    }

    for (let i = 0; i < 99; i++) {
      const edge = createEdge(nodes[i]!, nodes[i + 1]!);
      edges.push(edge);
      nodes[i]!._targets = edge;
    }

    traverseAndInvalidate(edges[0]);

    // All nodes should be notified (but not outdated - that's determined lazily)
    for (let i = 1; i < 100; i++) {
      expect(nodes[i]!._flags & NOTIFIED).toBeTruthy();
      expect(nodes[i]!._flags & OUTDATED).toBeFalsy();
    }
  });
});
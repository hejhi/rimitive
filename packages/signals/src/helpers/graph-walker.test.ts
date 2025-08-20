import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphWalker } from './graph-walker';
import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode, ProducerNode, ScheduledNode } from '../types';

const { INVALIDATED, STALE, DISPOSED, RUNNING } = CONSTANTS;

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

    walk = createGraphWalker().walk;
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
      _updateValue: () => true,
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
      fromVersion: 0,
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

    // With push-pull optimization, computeds only get INVALIDATED, not STALE
    expect(target._flags & INVALIDATED).toBeTruthy();
    expect(target._flags & STALE).toBeFalsy();
  });

  it('should mark effects as INVALIDATED only (lazy evaluation for all)', () => {
    const source = createMockNode('signal') as ProducerNode;
    const effect = createMockNode('effect', 0, true); // isScheduled = true
    const edge = createEdge(source, effect);

    walk(edge, visit);

    // Effects now also use lazy evaluation - only INVALIDATED, not STALE
    expect(effect._flags & INVALIDATED).toBeTruthy();
    expect(effect._flags & STALE).toBeFalsy();
  });

  it('should skip already notified nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', INVALIDATED);
    const edge = createEdge(source, target);

    const initialFlags = target._flags;
    walk(edge, visit);

    expect(target._flags).toBe(initialFlags);
  });

  it('should skip disposed nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', DISPOSED);
    const edge = createEdge(source, target);

    const initialFlags = target._flags;
    walk(edge, visit);

    expect(target._flags).toBe(initialFlags);
  });

  it('should skip running nodes', () => {
    const source = createMockNode('signal') as ProducerNode;
    const target = createMockNode('computed', RUNNING);
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

    expect(target1._flags & INVALIDATED).toBeTruthy();
    expect(target2._flags & INVALIDATED).toBeTruthy();
    expect(target3._flags & INVALIDATED).toBeTruthy();
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

    expect(computed1._flags & INVALIDATED).toBeTruthy();
    expect(computed2._flags & INVALIDATED).toBeTruthy();
    expect(effect._flags & INVALIDATED).toBeTruthy();
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

    expect(computed1._flags & INVALIDATED).toBeTruthy();
    expect(computed2._flags & INVALIDATED).toBeTruthy();
    expect(computed3._flags & INVALIDATED).toBeTruthy();
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
    expect(comp1._flags & INVALIDATED).toBeTruthy();
    expect(comp2._flags & INVALIDATED).toBeTruthy();
    expect(comp3._flags & INVALIDATED).toBeTruthy();
    expect(comp4._flags & INVALIDATED).toBeTruthy();
    expect(eff1._flags & INVALIDATED).toBeTruthy();
    expect(eff2._flags & INVALIDATED).toBeTruthy();
    expect(eff3._flags & INVALIDATED).toBeTruthy();

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

    // All nodes should be notified (but not outdated - that's determined lazily)
    for (let i = 1; i < 100; i++) {
      expect(nodes[i]!._flags & INVALIDATED).toBeTruthy();
      expect(nodes[i]!._flags & STALE).toBeFalsy();
    }
  });
});

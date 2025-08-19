import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestInstance } from '../test-setup';
import { createPropagator } from './propagator';
import type { Edge, ConsumerNode } from '../types';

// Type for Edge with queue extensions
type QueuedEdge = Edge & { _queued: boolean; _queueNext: Edge | undefined };

describe('Propagator Unit Tests', () => {
  describe('Direct Propagator API', () => {
    it('should accumulate roots without duplication', () => {
      const propagator = createPropagator();
      const mockEdge1 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const mockEdge2 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      expect(propagator.size()).toBe(0);
      
      propagator.add(mockEdge1);
      expect(propagator.size()).toBe(1);
      
      propagator.add(mockEdge2);
      expect(propagator.size()).toBe(2);
      
      // Adding same edge again should not increase size
      propagator.add(mockEdge1);
      expect(propagator.size()).toBe(2);
    });
    
    it('should set queued flag and maintain intrusive queue', () => {
      const propagator = createPropagator();
      const mockEdge1 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const mockEdge2 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      propagator.add(mockEdge1);
      propagator.add(mockEdge2);
      
      expect(mockEdge1._queued).toBe(true);
      expect(mockEdge2._queued).toBe(true);
      
      // Check intrusive queue linkage
      propagator.clear();
      expect(mockEdge1._queued).toBe(false);
      expect(mockEdge2._queued).toBe(false);
      expect(mockEdge1._queueNext).toBeUndefined();
      expect(mockEdge2._queueNext).toBeUndefined();
    });
    
    it('should clear accumulated roots and reset flags', () => {
      const propagator = createPropagator();
      const mockEdge = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      propagator.add(mockEdge);
      expect(propagator.size()).toBe(1);
      
      propagator.clear();
      expect(propagator.size()).toBe(0);
      expect(mockEdge._queued).toBe(false);
    });
    
    it('should handle propagate with dfsMany', () => {
      const propagator = createPropagator();
      const mockInvalidateEdge = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      propagator.add(mockInvalidateEdge);
      
      const visitSpy = vi.fn();
      const mockDfsMany = vi.fn();
      
      propagator.propagate(mockDfsMany, visitSpy);
      
      expect(mockDfsMany).toHaveBeenCalledWith(mockInvalidateEdge, visitSpy);
      expect(propagator.size()).toBe(0); // Should clear after propagate
    });
    
    it('should handle invalidate with simple strategy', () => {
      const propagator = createPropagator();
      const mockEdge1 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const mockEdge2 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      const visitSpy = vi.fn();
      const dfsSpy = vi.fn();
      
      // Non-batched: immediate dfs
      propagator.invalidate(mockEdge1, false, dfsSpy, visitSpy);
      expect(dfsSpy).toHaveBeenCalledWith(mockEdge1, visitSpy);
      expect(propagator.size()).toBe(0);
      
      dfsSpy.mockClear();
      
      // Batched: always accumulate for batch-end processing
      propagator.invalidate(mockEdge1, true, dfsSpy, visitSpy);
      expect(dfsSpy).not.toHaveBeenCalled();
      expect(propagator.size()).toBe(1);
      
      propagator.clear(); // Reset for next test
      
      propagator.invalidate(mockEdge2, true, dfsSpy, visitSpy);
      expect(dfsSpy).not.toHaveBeenCalled();
      expect(propagator.size()).toBe(1);
    });
    
    it('should process all accumulated roots via propagate', () => {
      const propagator = createPropagator();
      const mockDfsMany = vi.fn((head: Edge | undefined, visit: (node: ConsumerNode) => void) => {
        // Simulate traversal
        let current = head as QueuedEdge | undefined;
        while (current) {
          visit({} as ConsumerNode);
          current = current._queueNext as QueuedEdge | undefined;
        }
      });
      const visitSpy = vi.fn();
      
      // Accumulate multiple roots
      const mockEdge1 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const mockEdge2 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      
      propagator.add(mockEdge1);
      propagator.add(mockEdge2);
      
      propagator.propagate(mockDfsMany, visitSpy);
      
      expect(mockDfsMany).toHaveBeenCalledTimes(1);
      expect(visitSpy).toHaveBeenCalledTimes(2); // Should visit both roots
      expect(propagator.size()).toBe(0);
    });
    
    it('should clear accumulated roots after propagate', () => {
      const propagator = createPropagator();
      const mockEdge1 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const mockEdge2 = { _queued: false, _queueNext: undefined } as QueuedEdge;
      const dfsSpy = vi.fn();
      const visitSpy = vi.fn();
      
      // Accumulate edges in batch
      propagator.invalidate(mockEdge1, true, dfsSpy, visitSpy);
      propagator.invalidate(mockEdge2, true, dfsSpy, visitSpy);
      expect(propagator.size()).toBe(2);
      
      // Propagate should clear accumulated roots
      propagator.propagate(vi.fn(), vi.fn());
      expect(propagator.size()).toBe(0);
      
      // Next batch should start fresh
      propagator.invalidate(mockEdge1, true, dfsSpy, visitSpy);
      expect(propagator.size()).toBe(1);
    });
  });
});

describe('Propagator Large Batch Behavior', () => {
  let api: ReturnType<typeof createTestInstance>;
  
  beforeEach(() => {
    api = createTestInstance();
  });

  it('should handle large batches with 3+ signal updates', () => {
    const s1 = api.signal(1);
    const s2 = api.signal(2);
    const s3 = api.signal(3);
    
    const sum = api.computed(() => s1() + s2() + s3());
    
    let effectCount = 0;
    let lastSum = 0;
    api.effect(() => {
      effectCount++;
      lastSum = sum();
    });
    
    // Initial effect run
    expect(effectCount).toBe(1);
    expect(lastSum).toBe(6);
    
    // Large batch with 3 signals (should trigger propagator accumulation)
    api.batch(() => {
      s1(10);
      s2(20);
      s3(30);
    });
    
    // This might fail if propagate() is never called!
    expect(effectCount).toBe(2);
    expect(lastSum).toBe(60);
    expect(sum()).toBe(60);
  });
  
  it('should correctly propagate all signals in large batches', () => {
    // Create 5 signals that each connect to their own computed
    const signals = Array.from({ length: 5 }, (_, i) => api.signal(i));
    const computeds = signals.map((s) => 
      api.computed(() => s() * 2)
    );
    
    let effectRuns = 0;
    const allValues: number[][] = [];
    api.effect(() => {
      effectRuns++;
      allValues.push(computeds.map(c => c()));
    });
    
    // Initial run
    expect(effectRuns).toBe(1);
    expect(allValues[0]).toEqual([0, 2, 4, 6, 8]);
    
    // Update all 5 signals in a batch
    // First 2 should trigger immediate dfs()
    // Signals 3-5 should be accumulated and processed via propagate()
    api.batch(() => {
      signals[0]!(10);  // immediate dfs
      signals[1]!(20);  // immediate dfs
      signals[2]!(30);  // accumulated
      signals[3]!(40);  // accumulated
      signals[4]!(50);  // accumulated
    });
    
    // Check if all computeds updated
    expect(computeds[0]!()).toBe(20);
    expect(computeds[1]!()).toBe(40);
    expect(computeds[2]!()).toBe(60);
    expect(computeds[3]!()).toBe(80);
    expect(computeds[4]!()).toBe(100);
    
    expect(effectRuns).toBe(2);
    expect(allValues[1]).toEqual([20, 40, 60, 80, 100]);
  });
});
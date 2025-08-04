import { describe, it, expect, vi } from 'vitest';
import { createContext } from '../context';
import { createDependencyHelpers } from './dependency-tracking';
import type { ProducerNode, ConsumerNode } from '../types';

describe('Edge cache optimization', () => {
  it('should use cached edge on repeated access', () => {
    const ctx = createContext();
    const { addDependency, linkNodes } = createDependencyHelpers();
    
    // Create mock producer and consumer
    const producer: ProducerNode & { _lastEdge?: any } = {
      __type: 'signal',
      _targets: undefined,
      _version: 1
    };
    
    const consumer: ConsumerNode = {
      __type: 'computed',
      _sources: undefined,
      _invalidate: vi.fn()
    };
    
    // First access - should create new edge
    addDependency(producer, consumer, 1);
    
    expect(producer._lastEdge).toBeDefined();
    expect(producer._lastEdge?.target).toBe(consumer);
    
    // Second access - should use cached edge
    const cachedEdge = producer._lastEdge;
    addDependency(producer, consumer, 2);
    
    // Should reuse same edge object
    expect(producer._lastEdge).toBe(cachedEdge);
    expect(producer._lastEdge?.version).toBe(2);
  });
  
  it('should update cache when finding edge via linear search', () => {
    const ctx = createContext();
    const { addDependency, linkNodes } = createDependencyHelpers();
    
    // Create producer and two consumers
    const producer: ProducerNode & { _lastEdge?: any } = {
      __type: 'signal',
      _targets: undefined,
      _version: 1
    };
    
    const consumer1: ConsumerNode = {
      __type: 'computed',
      _sources: undefined,
      _invalidate: vi.fn()
    };
    
    const consumer2: ConsumerNode = {
      __type: 'computed',
      _sources: undefined,
      _invalidate: vi.fn()
    };
    
    // Add both dependencies
    addDependency(producer, consumer1, 1);
    addDependency(producer, consumer2, 1);
    
    // Cache should point to consumer2 (most recent)
    expect(producer._lastEdge?.target).toBe(consumer2);
    
    // Access consumer1 again - should update cache via linear search
    addDependency(producer, consumer1, 2);
    
    // Cache should now point to consumer1
    expect(producer._lastEdge?.target).toBe(consumer1);
    expect(producer._lastEdge?.version).toBe(2);
  });
  
  it('should demonstrate cache hit vs miss performance', () => {
    const ctx = createContext();
    const { addDependency } = createDependencyHelpers();
    
    const producer: ProducerNode & { _lastEdge?: any } = {
      __type: 'signal',
      _targets: undefined,
      _version: 1
    };
    
    // Create many consumers to make linear search slower
    const consumers: ConsumerNode[] = [];
    for (let i = 0; i < 20; i++) {
      consumers.push({
        __type: 'computed',
        _sources: undefined,
        _invalidate: vi.fn()
      });
    }
    
    // Add all dependencies
    consumers.forEach(c => addDependency(producer, c, 1));
    
    // Measure repeated access to last consumer (best case for cache)
    const lastConsumer = consumers[19];
    const iterations = 100000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      addDependency(producer, lastConsumer, i);
    }
    const cached = performance.now() - start;
    
    // Force cache miss by accessing first consumer
    addDependency(producer, consumers[0], 1);
    
    // Clear cache and measure access pattern that always misses
    const iterations2 = 1000;
    
    // This simulates the worst case: alternating between different consumers
    // so cache is always wrong
    const start2 = performance.now();
    for (let i = 0; i < iterations2; i++) {
      // Access consumers in round-robin, cache will always miss
      const consumer = consumers[i % consumers.length];
      addDependency(producer, consumer, i);
    }
    const uncached = performance.now() - start2;
    
    // Normalize to same iteration count
    const normalizedCached = cached / iterations;
    const normalizedUncached = uncached / iterations2;
    
    // Cache should be significantly faster
    console.log(`Cached: ${normalizedCached.toFixed(6)}ms per op`);
    console.log(`Uncached: ${normalizedUncached.toFixed(6)}ms per op`);
    console.log(`Cache speedup: ${(normalizedUncached / normalizedCached).toFixed(1)}x`);
    
    // Even with just 20 consumers, cache should provide measurable speedup
    expect(normalizedUncached / normalizedCached).toBeGreaterThan(2);
  });
});
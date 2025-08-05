/**
 * PROOF OF CONCEPT: Value-based Caching for Computed Signals
 * 
 * This demonstrates an optimization where we check if dependency VALUES
 * (not just versions) have actually changed before recomputing.
 * 
 * The key insight: Sometimes dependencies get new versions but their
 * values remain the same. In these cases, we can skip recomputation
 * and just clear the NOTIFIED flag.
 * 
 * This is particularly beneficial for:
 * 1. Filtered diamond patterns where filters often return the same result
 * 2. Computeds that map/transform values that often don't change
 * 3. Complex dependency graphs where invalidations propagate widely
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSignalAPI } from '../api';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createEffectFactory } from '../effect';
import { createBatchFactory } from '../batch';
import { CONSTANTS } from '../constants';

describe('Value Caching POC', () => {
  type API = ReturnType<typeof createSignalAPI<{
    signal: typeof createSignalFactory;
    computed: typeof createComputedFactory;
    effect: typeof createEffectFactory;
    batch: typeof createBatchFactory;
  }>>;
  
  let api: API;
  let signal: API['signal'];
  let computed: API['computed'];
  let effect: API['effect'];
  let batch: API['batch'];

  beforeEach(() => {
    api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    });
    signal = api.signal;
    computed = api.computed;
    effect = api.effect;
    batch = api.batch;
  });

  // Extended Computed interface with value caching capability
  interface ComputedWithPeek<T> {
    value: T;
    peek(): T;
    _refresh(): boolean;
    _peekDirty(): boolean;
    _cachedDependencyValues?: Map<any, any>;
    _flags: number;
    _sources: any;
    _targets: any;
    _version: number;
    _globalVersion: number;
    _value: T | undefined;
    _callback: () => T;
    _recompute(): void;
  }

  // Helper to add value caching to a computed
  function addValueCaching<T>(comp: any): ComputedWithPeek<T> {
    const original = comp as ComputedWithPeek<T>;
  
  // Cache to store dependency values
  original._cachedDependencyValues = new Map();
  
  // Check if any dependency VALUES have changed (not just versions)
  original._peekDirty = function() {
    let source = this._sources;
    let anyValueChanged = false;
    
    while (source) {
      const sourceNode = source.source;
      
      // For signals, peek the current value
      if ('value' in sourceNode && !('_sources' in sourceNode)) {
        const currentValue = sourceNode.value;
        const cachedValue = this._cachedDependencyValues.get(sourceNode);
        
        if (cachedValue === undefined || cachedValue !== currentValue) {
          anyValueChanged = true;
          this._cachedDependencyValues.set(sourceNode, currentValue);
        }
      }
      // For computeds, recursively check if they're dirty
      else if ('_sources' in sourceNode && '_peekDirty' in sourceNode) {
        // First refresh the computed to ensure it's up to date
        sourceNode._refresh();
        const currentValue = sourceNode._value;
        const cachedValue = this._cachedDependencyValues.get(sourceNode);
        
        if (cachedValue === undefined || cachedValue !== currentValue) {
          anyValueChanged = true;
          this._cachedDependencyValues.set(sourceNode, currentValue);
        }
      }
      
      source = source.nextSource;
    }
    
    return anyValueChanged;
  };
  
  // Override _refresh to use _peekDirty
  const originalRefresh = original._refresh;
  original._refresh = function() {
    const { RUNNING, OUTDATED, NOTIFIED, TRACKING } = CONSTANTS;
    
    // If we're currently computing, we have a cycle
    if (this._flags & RUNNING) return false;
    
    // If we have the TRACKING flag and are not OUTDATED or NOTIFIED, we're fresh
    if ((this._flags & (OUTDATED | NOTIFIED | TRACKING)) === TRACKING) {
      return true;
    }
    
    // Clear NOTIFIED flag as we're handling it now
    this._flags &= ~NOTIFIED;
    
    // Clear OUTDATED flag as we're about to check/update
    this._flags &= ~OUTDATED;
    
    // OPTIMIZATION: Global version check
    if (this._globalVersion === api._ctx.version) {
      return true;
    }
    
    // NEW OPTIMIZATION: Check if any dependency VALUES changed
    // If we're not on first run and no values changed, skip recomputation
    if (this._version > 0 && !this._peekDirty()) {
      // No values changed - just update global version and return
      this._globalVersion = api._ctx.version;
      return true;
    }
    
    // Values changed or first run - recompute
    this._recompute();
    
    return true;
  };
  
  // Override _recompute to clear cached values when dependencies change
  const originalRecompute = original._recompute;
  original._recompute = function() {
    // Clear cached values as dependencies might have changed
    this._cachedDependencyValues.clear();
    
    // Run original recompute
    originalRecompute.call(this);
    
    // After recomputation, cache current dependency values
    let source = this._sources;
    while (source) {
      const sourceNode = source.source;
      if ('value' in sourceNode) {
        const currentValue = 'peek' in sourceNode ? sourceNode.peek() : sourceNode.value;
        this._cachedDependencyValues.set(sourceNode, currentValue);
      }
      source = source.nextSource;
    }
  };
  
    return original;
  }
  it('demonstrates value caching for filtered diamond pattern', () => {
    // Track computation counts
    let sourceComputations = 0;
    let filter1Computations = 0;
    let filter2Computations = 0;
    let consumerComputations = 0;
    
    // Source signal
    const source = signal(10);
    
    // Two filters that often return the same result
    const filter1 = computed(() => {
      filter1Computations++;
      const val = source.value;
      // Only passes even numbers, otherwise returns 0
      return val % 2 === 0 ? val : 0;
    });
    
    const filter2 = computed(() => {
      filter2Computations++;
      const val = source.value;
      // Only passes multiples of 5, otherwise returns 0
      return val % 5 === 0 ? val : 0;
    });
    
    // Consumer that combines both filters
    const consumer = computed(() => {
      consumerComputations++;
      return filter1.value + filter2.value;
    });
    
    // Add value caching to our computeds
    addValueCaching(filter1);
    addValueCaching(filter2);
    addValueCaching(consumer);
    
    // Initial computation
    expect(consumer.value).toBe(10 + 10); // Both filters pass 10
    expect(filter1Computations).toBe(1);
    expect(filter2Computations).toBe(1);
    expect(consumerComputations).toBe(1);
    
    // Change to 11 - both filters will return 0
    source.value = 11;
    expect(consumer.value).toBe(0 + 0);
    expect(filter1Computations).toBe(2);
    expect(filter2Computations).toBe(2);
    expect(consumerComputations).toBe(2);
    
    // Change to 13 - both filters still return 0
    // WITHOUT value caching: consumer would recompute
    // WITH value caching: consumer sees filter values haven't changed
    source.value = 13;
    expect(consumer.value).toBe(0 + 0);
    expect(filter1Computations).toBe(3);
    expect(filter2Computations).toBe(3);
    // Consumer should NOT recompute since both filters still return 0
    expect(consumerComputations).toBe(2); // Still 2!
    
    // Change to 14 - filter1 returns 14, filter2 returns 0
    source.value = 14;
    expect(consumer.value).toBe(14 + 0);
    expect(filter1Computations).toBe(4);
    expect(filter2Computations).toBe(4);
    expect(consumerComputations).toBe(3); // Now it recomputes
    
    // Change to 16 - filter1 returns 16, filter2 still returns 0
    source.value = 16;
    expect(consumer.value).toBe(16 + 0);
    expect(filter1Computations).toBe(5);
    expect(filter2Computations).toBe(5);
    expect(consumerComputations).toBe(4); // Recomputes because filter1 changed
    
    // Change to 17 - both filters return 0 again
    source.value = 17;
    expect(consumer.value).toBe(0 + 0);
    expect(filter1Computations).toBe(6);
    expect(filter2Computations).toBe(6);
    expect(consumerComputations).toBe(5);
    
    // Change to 19 - both filters still return 0
    source.value = 19;
    expect(consumer.value).toBe(0 + 0);
    expect(filter1Computations).toBe(7);
    expect(filter2Computations).toBe(7);
    // Consumer should NOT recompute since both filters still return 0
    expect(consumerComputations).toBe(5); // Still 5!
    
    // Change to 20 - both filters pass
    source.value = 20;
    expect(consumer.value).toBe(20 + 20);
    expect(filter1Computations).toBe(8);
    expect(filter2Computations).toBe(8);
    expect(consumerComputations).toBe(6); // Recomputes because values changed
  });
  
  it('demonstrates value caching with nested computeds', () => {
    let computations = { a: 0, b: 0, c: 0, d: 0 };
    
    const source = signal(1);
    
    // Computed that squares the value
    const a = computed(() => {
      computations.a++;
      return source.value * source.value;
    });
    
    // Computed that caps at 10
    const b = computed(() => {
      computations.b++;
      return Math.min(a.value, 10);
    });
    
    // Computed that doubles if under 10
    const c = computed(() => {
      computations.c++;
      const val = b.value;
      return val < 10 ? val * 2 : val;
    });
    
    // Final consumer
    const d = computed(() => {
      computations.d++;
      return c.value + 100;
    });
    
    // Add value caching
    addValueCaching(a);
    addValueCaching(b);
    addValueCaching(c);
    addValueCaching(d);
    
    // Initial: 1 -> 1 -> 1 -> 2 -> 102
    expect(d.value).toBe(102);
    expect(computations).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    
    // Change to 2: 2 -> 4 -> 4 -> 8 -> 108
    source.value = 2;
    expect(d.value).toBe(108);
    expect(computations).toEqual({ a: 2, b: 2, c: 2, d: 2 });
    
    // Change to 3: 3 -> 9 -> 9 -> 18 -> 118
    source.value = 3;
    expect(d.value).toBe(118);
    expect(computations).toEqual({ a: 3, b: 3, c: 3, d: 3 });
    
    // Change to 4: 4 -> 16 -> 10 -> 10 -> 110
    // Note: b caps at 10, so c doesn't double it
    source.value = 4;
    expect(d.value).toBe(110);
    expect(computations).toEqual({ a: 4, b: 4, c: 4, d: 4 });
    
    // Change to 5: 5 -> 25 -> 10 -> 10 -> 110
    // b still returns 10, so c and d should NOT recompute
    source.value = 5;
    expect(d.value).toBe(110);
    expect(computations).toEqual({ 
      a: 5, // a recomputes (25 != 16)
      b: 5, // b recomputes but still returns 10
      c: 4, // c does NOT recompute (b's value didn't change)
      d: 4  // d does NOT recompute (c's value didn't change)
    });
    
    // Change to 6: 6 -> 36 -> 10 -> 10 -> 110
    // Still capped at 10
    source.value = 6;
    expect(d.value).toBe(110);
    expect(computations).toEqual({ 
      a: 6, // a recomputes
      b: 6, // b recomputes but still returns 10
      c: 4, // c still doesn't recompute
      d: 4  // d still doesn't recompute
    });
  });
  
  it('demonstrates value caching with boolean computeds', () => {
    let computations = { isEven: 0, isPositive: 0, both: 0 };
    
    const num = signal(1);
    
    const isEven = computed(() => {
      computations.isEven++;
      return num.value % 2 === 0;
    });
    
    const isPositive = computed(() => {
      computations.isPositive++;
      return num.value > 0;
    });
    
    const both = computed(() => {
      computations.both++;
      return isEven.value && isPositive.value;
    });
    
    // Add value caching
    addValueCaching(isEven);
    addValueCaching(isPositive);
    addValueCaching(both);
    
    // Initial: 1 -> false, true -> false
    expect(both.value).toBe(false);
    // Note: due to short-circuit evaluation, isPositive is not evaluated when isEven is false
    expect(computations).toEqual({ isEven: 1, isPositive: 0, both: 1 });
    
    // Change to 3: still odd and positive
    num.value = 3;
    expect(both.value).toBe(false);
    expect(computations).toEqual({ 
      isEven: 2,     // recomputes but still false
      isPositive: 0, // still not evaluated due to short-circuit
      both: 1        // does NOT recompute (isEven didn't change)
    });
    
    // Change to 2: now even and positive
    num.value = 2;
    expect(both.value).toBe(true);
    expect(computations).toEqual({ 
      isEven: 3,     // recomputes to true
      isPositive: 1, // NOW evaluated for the first time (isEven is true)
      both: 2        // recomputes because isEven changed
    });
    
    // Change to 4: still even and positive
    num.value = 4;
    expect(both.value).toBe(true);
    expect(computations).toEqual({ 
      isEven: 4,     // recomputes but still true
      isPositive: 2, // recomputes but still true
      both: 2        // does NOT recompute
    });
    
    // Change to -2: even but negative
    num.value = -2;
    expect(both.value).toBe(false);
    expect(computations).toEqual({ 
      isEven: 5,     // recomputes but still true
      isPositive: 3, // recomputes to false
      both: 3        // recomputes because isPositive changed
    });
  });
});

/**
 * SUMMARY OF VALUE CACHING OPTIMIZATION:
 * 
 * 1. We add a _peekDirty() method that checks if dependency VALUES changed
 * 2. We cache dependency values in _cachedDependencyValues Map
 * 3. In _refresh(), we use _peekDirty() to check if recomputation is needed
 * 4. If no values changed, we skip _recompute() and just clear flags
 * 
 * BENEFITS:
 * - Reduces unnecessary recomputations when versions change but values don't
 * - Particularly effective for:
 *   - Filters that often return the same result
 *   - Boolean computeds that toggle less frequently than their inputs
 *   - Computeds that cap/clamp values
 *   - Any computed where output changes less frequently than inputs
 * 
 * TRADE-OFFS:
 * - Additional memory usage for cached values
 * - Extra equality checks during _peekDirty()
 * - Complexity of maintaining value cache
 * 
 * POTENTIAL IMPROVEMENTS:
 * - Could use WeakMap for better memory management
 * - Could make value caching opt-in per computed
 * - Could use custom equality functions for complex values
 * - Could add heuristics to disable caching for frequently-changing computeds
 */
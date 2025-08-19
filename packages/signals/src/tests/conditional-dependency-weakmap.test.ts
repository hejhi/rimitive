import { describe, it, expect, beforeEach } from 'vitest';
import { createTestInstance } from '../test-setup';

describe('Conditional Dependencies with WeakMap', () => {
  let instance: ReturnType<typeof createTestInstance>;
  let signal: typeof instance.signal;
  let computed: typeof instance.computed;
  let effect: typeof instance.effect;

  beforeEach(() => {
    instance = createTestInstance();
    signal = instance.signal;
    computed = instance.computed;
    effect = instance.effect;
  });

  it('should correctly re-establish conditional dependencies after pruning', () => {
    // This test demonstrates the WeakMap bug:
    // When a conditional dependency is pruned and later re-established,
    // the old edge remains in the WeakMap causing incorrect behavior
    
    const showDetails = signal(true);
    const name = signal('Alice');
    const description = signal('Engineer');
    let computeCount = 0;
    
    const display = computed(() => {
      computeCount++;
      if (showDetails()) {
        return `${name()}: ${description()}`;
      }
      return name();
    });
    
    // Initial computation - depends on all three signals
    expect(display()).toBe('Alice: Engineer');
    expect(computeCount).toBe(1);
    
    // Change to false - prunes the edge to description
    showDetails(false);
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2);
    
    // Update description - should NOT trigger recomputation
    // since the edge was pruned
    description('Senior Engineer');
    expect(display()).toBe('Alice');
    expect(computeCount).toBe(2); // Should still be 2
    
    // Re-enable details - should re-establish the edge
    showDetails(true);
    expect(display()).toBe('Alice: Senior Engineer');
    expect(computeCount).toBe(3);
    
    // NOW updating description should trigger recomputation
    // This is where the bug occurs: the old pruned edge is found
    // in the WeakMap but it's not in the linked list
    description('Principal Engineer');
    expect(display()).toBe('Alice: Principal Engineer');
    expect(computeCount).toBe(4); // This might fail if the edge isn't properly re-linked
  });

  it('should handle multiple cycles of conditional dependency changes', () => {
    const useA = signal(true);
    const a = signal('A');
    const b = signal('B');
    let computeCount = 0;
    let effectCount = 0;
    
    const result = computed(() => {
      computeCount++;
      return useA() ? a() : b();
    });
    
    effect(() => {
      effectCount++;
      // Access the computed to establish dependency
      void result();
    });
    
    expect(effectCount).toBe(1);
    expect(computeCount).toBe(1);
    
    // Switch to B
    useA(false);
    expect(result()).toBe('B');
    expect(effectCount).toBe(2);
    expect(computeCount).toBe(2);
    
    // Update A - should not trigger since edge is pruned
    a('A2');
    expect(result()).toBe('B');
    expect(effectCount).toBe(2); // No change
    expect(computeCount).toBe(2); // No change
    
    // Switch back to A
    useA(true);
    expect(result()).toBe('A2');
    expect(effectCount).toBe(3);
    expect(computeCount).toBe(3);
    
    // Update A again - should trigger
    a('A3');
    expect(result()).toBe('A3');
    expect(effectCount).toBe(4);
    expect(computeCount).toBe(4);
    
    // One more cycle to ensure it works repeatedly
    useA(false);
    b('B2');
    expect(result()).toBe('B2');
    expect(effectCount).toBe(6); // Changed twice
    
    useA(true);
    a('A4');
    expect(result()).toBe('A4');
    expect(effectCount).toBe(8); // Changed twice more
  });
});
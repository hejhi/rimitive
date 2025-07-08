import { describe, it, expect } from 'vitest';
import { createLatticeContext } from './context';

describe('Component Isolation', () => {
  it('should isolate signal contexts between components', () => {
    // Create two separate contexts
    const context1 = createLatticeContext();
    const context2 = createLatticeContext();

    // Create signals in each context
    const signal1 = context1.signal(10);
    const signal2 = context2.signal(20);

    // Create computed values that depend on the signals
    const computed1 = context1.computed(() => signal1.value * 2);
    const computed2 = context2.computed(() => signal2.value * 2);

    // Initial values
    expect(computed1.value).toBe(20);
    expect(computed2.value).toBe(40);

    // Update signal in context 1
    signal1.value = 15;
    expect(computed1.value).toBe(30);
    expect(computed2.value).toBe(40); // Should not be affected

    // Update signal in context 2
    signal2.value = 25;
    expect(computed1.value).toBe(30); // Should not be affected
    expect(computed2.value).toBe(50);
  });

  it('should isolate effects between components', () => {
    const context1 = createLatticeContext();
    const context2 = createLatticeContext();

    const signal1 = context1.signal(0);
    const signal2 = context2.signal(0);

    let effect1Count = 0;
    let effect2Count = 0;

    // Create effects in each context
    context1.effect(() => {
      void signal1.value; // Subscribe to signal1
      effect1Count++;
    });

    context2.effect(() => {
      void signal2.value; // Subscribe to signal2
      effect2Count++;
    });

    // Initial run
    expect(effect1Count).toBe(1);
    expect(effect2Count).toBe(1);

    // Update signal in context 1
    signal1.value = 1;
    expect(effect1Count).toBe(2);
    expect(effect2Count).toBe(1); // Should not be affected

    // Update signal in context 2
    signal2.value = 1;
    expect(effect1Count).toBe(2); // Should not be affected
    expect(effect2Count).toBe(2);
  });

  it('should batch independently in each context', () => {
    const context1 = createLatticeContext();
    const context2 = createLatticeContext();

    const signal1a = context1.signal(1);
    const signal1b = context1.signal(2);
    const signal2a = context2.signal(3);
    const signal2b = context2.signal(4);

    let compute1Count = 0;
    let compute2Count = 0;

    const computed1 = context1.computed(() => {
      compute1Count++;
      return signal1a.value + signal1b.value;
    });

    const computed2 = context2.computed(() => {
      compute2Count++;
      return signal2a.value + signal2b.value;
    });

    // Initial computation
    expect(computed1.value).toBe(3);
    expect(computed2.value).toBe(7);
    expect(compute1Count).toBe(1);
    expect(compute2Count).toBe(1);

    // Batch updates in context 1
    context1.batch(() => {
      signal1a.value = 10;
      signal1b.value = 20;
    });

    // Check that only context 1 was affected
    expect(computed1.value).toBe(30);
    expect(computed2.value).toBe(7);
    expect(compute1Count).toBe(2);
    expect(compute2Count).toBe(1);

    // Batch updates in context 2
    context2.batch(() => {
      signal2a.value = 30;
      signal2b.value = 40;
    });

    // Check that only context 2 was affected
    expect(computed1.value).toBe(30);
    expect(computed2.value).toBe(70);
    expect(compute1Count).toBe(2);
    expect(compute2Count).toBe(2);
  });

  it('should handle nested components with separate contexts', () => {
    const parentContext = createLatticeContext();
    const childContext1 = createLatticeContext();
    const childContext2 = createLatticeContext();

    const parentSignal = parentContext.signal('parent');
    const child1Signal = childContext1.signal('child1');
    const child2Signal = childContext2.signal('child2');

    // Create computed values that show independence
    const parentComputed = parentContext.computed(
      () => `${parentSignal.value}-computed`
    );
    const child1Computed = childContext1.computed(
      () => `${child1Signal.value}-computed`
    );
    const child2Computed = childContext2.computed(
      () => `${child2Signal.value}-computed`
    );

    expect(parentComputed.value).toBe('parent-computed');
    expect(child1Computed.value).toBe('child1-computed');
    expect(child2Computed.value).toBe('child2-computed');

    // Update parent - children should not be affected
    parentSignal.value = 'parent-updated';
    expect(parentComputed.value).toBe('parent-updated-computed');
    expect(child1Computed.value).toBe('child1-computed');
    expect(child2Computed.value).toBe('child2-computed');

    // Update child1 - parent and child2 should not be affected
    child1Signal.value = 'child1-updated';
    expect(parentComputed.value).toBe('parent-updated-computed');
    expect(child1Computed.value).toBe('child1-updated-computed');
    expect(child2Computed.value).toBe('child2-computed');
  });

  it('should not share dependency tracking between contexts', () => {
    const context1 = createLatticeContext();
    const context2 = createLatticeContext();

    const sharedValue = { count: 0 };

    // Create signals that reference the same object
    const signal1 = context1.signal(sharedValue);
    const signal2 = context2.signal(sharedValue);

    let effect1Runs = 0;
    let effect2Runs = 0;

    // Effects that read from their respective signals
    context1.effect(() => {
      void signal1.value.count;
      effect1Runs++;
    });

    context2.effect(() => {
      void signal2.value.count;
      effect2Runs++;
    });

    expect(effect1Runs).toBe(1);
    expect(effect2Runs).toBe(1);

    // Update through context1 - only effect1 should run
    signal1.value = { count: 1 };
    expect(effect1Runs).toBe(2);
    expect(effect2Runs).toBe(1);

    // Update through context2 - only effect2 should run
    signal2.value = { count: 2 };
    expect(effect1Runs).toBe(2);
    expect(effect2Runs).toBe(2);
  });
});

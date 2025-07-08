import { describe, it, expect, vi } from 'vitest';
import { createLatticeContext } from './context';

describe('Context Disposal', () => {
  it('should dispose all effects when context is disposed', () => {
    const context = createLatticeContext();
    const signal1 = context.signal(0);
    const signal2 = context.signal(0);
    
    let effect1Runs = 0;
    let effect2Runs = 0;
    
    context.effect(() => {
      void signal1.value;
      effect1Runs++;
    });
    
    context.effect(() => {
      void signal2.value;
      effect2Runs++;
    });
    
    expect(effect1Runs).toBe(1);
    expect(effect2Runs).toBe(1);
    
    // Update signals - effects should run
    signal1.value = 1;
    signal2.value = 1;
    expect(effect1Runs).toBe(2);
    expect(effect2Runs).toBe(2);
    
    // Dispose context
    context.dispose();
    
    // Update signals - effects should NOT run
    signal1.value = 2;
    signal2.value = 2;
    expect(effect1Runs).toBe(2); // No change
    expect(effect2Runs).toBe(2); // No change
  });

  it('should dispose all computeds when context is disposed', () => {
    const context = createLatticeContext();
    const signal = context.signal(10);
    
    let computeRuns = 0;
    const computed = context.computed(() => {
      computeRuns++;
      return signal.value * 2;
    });
    
    expect(computed.value).toBe(20);
    expect(computeRuns).toBe(1);
    
    signal.value = 20;
    expect(computed.value).toBe(40);
    expect(computeRuns).toBe(2);
    
    // Dispose context
    context.dispose();
    
    // After disposal, computed value becomes undefined
    expect(computed.value).toBe(undefined);
    
    // Update signal - computed should NOT recompute
    signal.value = 30;
    expect(computed.value).toBe(undefined); // Still undefined
    expect(computeRuns).toBe(2); // No new computation
  });

  it('should run effect cleanup functions on disposal', () => {
    const context = createLatticeContext();
    const cleanup = vi.fn();
    
    context.effect(() => {
      return cleanup;
    });
    
    expect(cleanup).not.toHaveBeenCalled();
    
    // Dispose context should run cleanup
    context.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should handle manual effect disposal', () => {
    const context = createLatticeContext();
    const signal = context.signal(0);
    
    let effectRuns = 0;
    const dispose = context.effect(() => {
      void signal.value;
      effectRuns++;
    });
    
    expect(effectRuns).toBe(1);
    
    // Manually dispose effect
    dispose();
    
    // Effect should not run anymore
    signal.value = 1;
    expect(effectRuns).toBe(1);
    
    // Context disposal should handle already-disposed effects gracefully
    expect(() => context.dispose()).not.toThrow();
  });

  it('should prevent creating new primitives after disposal', () => {
    const context = createLatticeContext();
    context.dispose();
    
    expect(() => context.signal(0)).toThrow('Cannot create signal in disposed context');
    expect(() => context.computed(() => 1)).toThrow('Cannot create computed in disposed context');
    expect(() => context.effect(() => {})).toThrow('Cannot create effect in disposed context');
  });

  it('should handle multiple independent contexts', () => {
    const context1 = createLatticeContext();
    const context2 = createLatticeContext();
    const context3 = createLatticeContext();
    
    const signal1 = context1.signal(0);
    const signal2 = context2.signal(0);
    const signal3 = context3.signal(0);
    
    let effect1Runs = 0;
    let effect2Runs = 0;
    let effect3Runs = 0;
    
    context1.effect(() => {
      void signal1.value;
      effect1Runs++;
    });
    
    context2.effect(() => {
      void signal2.value;
      effect2Runs++;
    });
    
    context3.effect(() => {
      void signal3.value;
      effect3Runs++;
    });
    
    expect(effect1Runs).toBe(1);
    expect(effect2Runs).toBe(1);
    expect(effect3Runs).toBe(1);
    
    // Dispose context1 - only its effects should stop
    context1.dispose();
    
    // Update all signals
    signal1.value = 1;
    signal2.value = 1;
    signal3.value = 1;
    
    expect(effect1Runs).toBe(1); // No change - disposed
    expect(effect2Runs).toBe(2); // Still active
    expect(effect3Runs).toBe(2); // Still active
    
    // Dispose remaining contexts
    context2.dispose();
    context3.dispose();
    
    // No more updates
    signal2.value = 2;
    signal3.value = 2;
    
    expect(effect2Runs).toBe(2); // No change
    expect(effect3Runs).toBe(2); // No change
  });
});
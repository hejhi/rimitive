import { describe, it, expect, vi } from 'vitest';
import { createContext } from './extension';
import { signalExtension } from './extensions/signal';
import { computedExtension } from './extensions/computed';
import { effectExtension } from './extensions/effect';
import { selectExtension } from './extensions/select';
import { subscribeExtension } from './extensions/subscribe';
import { batchExtension } from './extensions/batch';
import type { LatticeExtension } from './extension';

describe('Extension System', () => {
  it('should create a minimal context with only signal extension', () => {
    const context = createContext(signalExtension);
    
    // Only signal and dispose should exist
    expect('signal' in context).toBe(true);
    expect('dispose' in context).toBe(true);
    expect('computed' in context).toBe(false);
    expect('effect' in context).toBe(false);
    
    const count = context.signal(0);
    expect(count.value).toBe(0);
    
    count.value = 5;
    expect(count.value).toBe(5);
    
    context.dispose();
  });
  
  it('should create a context with multiple extensions', () => {
    const context = createContext(
      signalExtension,
      computedExtension,
      effectExtension
    );
    
    const count = context.signal(0);
    const doubled = context.computed(() => count.value * 2);
    
    let effectCount = 0;
    context.effect(() => {
      void count.value;
      effectCount++;
    });
    
    expect(effectCount).toBe(1);
    expect(doubled.value).toBe(0);
    
    count.value = 5;
    expect(doubled.value).toBe(10);
    expect(effectCount).toBe(2);
    
    context.dispose();
  });
  
  it('should handle select and subscribe extensions', () => {
    const context = createContext(
      signalExtension,
      selectExtension,
      subscribeExtension
    );
    
    const user = context.signal({ name: 'John', age: 30 });
    const name = context.select(user, u => u.name);
    
    let callCount = 0;
    const unsub = context.subscribe(name, () => callCount++);
    
    // Initial subscription doesn't trigger
    expect(callCount).toBe(0);
    
    // Name change triggers
    user.value = { name: 'Jane', age: 30 };
    expect(callCount).toBe(1);
    
    // Age change doesn't trigger (fine-grained reactivity)
    user.value = { name: 'Jane', age: 31 };
    expect(callCount).toBe(1);
    
    unsub();
    context.dispose();
  });
  
  it('should prevent operations after disposal', () => {
    const context = createContext(signalExtension, computedExtension);
    
    const count = context.signal(0);
    context.dispose();
    
    // After disposal, creating new resources should throw
    expect(() => context.signal(0)).toThrow('disposed');
    expect(() => context.computed(() => 1)).toThrow('disposed');
    
    // Existing signals still work
    count.value = 10;
    expect(count.value).toBe(10);
  });
  
  it('should support custom extensions', () => {
    // Custom extension that counts operations
    let operationCount = 0;
    
    const counterExtension: LatticeExtension<'counter', () => number> = {
      name: 'counter',
      method: () => ++operationCount,
      onCreate(ctx) {
        // Could register cleanup here
        ctx.onDispose(() => {
          operationCount = 0;
        });
      }
    };
    
    const context = createContext(counterExtension);
    
    expect(context.counter()).toBe(1);
    expect(context.counter()).toBe(2);
    expect(operationCount).toBe(2);
    
    context.dispose();
    expect(operationCount).toBe(0); // Reset by onDispose
  });
  
  
  it('should call lifecycle hooks', () => {
    const onCreate = vi.fn();
    const onDispose = vi.fn();
    
    const lifecycleExtension: LatticeExtension<'noop', () => void> = {
      name: 'noop',
      method: () => {},
      onCreate,
      onDispose
    };
    
    const context = createContext(lifecycleExtension);
    
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onDispose).not.toHaveBeenCalled();
    
    context.dispose();
    
    expect(onDispose).toHaveBeenCalledTimes(1);
  });
  
  it('should handle batch extension', () => {
    const context = createContext(
      signalExtension,
      batchExtension,
      effectExtension
    );
    
    const a = context.signal(1);
    const b = context.signal(2);
    
    let effectCount = 0;
    context.effect(() => {
      void a.value;
      void b.value;
      effectCount++;
    });
    
    expect(effectCount).toBe(1);
    
    // Without batch - would trigger twice
    context.batch(() => {
      a.value = 10;
      b.value = 20;
    });
    
    // With batch - triggers once
    expect(effectCount).toBe(2);
    
    context.dispose();
  });
});
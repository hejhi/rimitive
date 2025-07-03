import { describe, it, expect, vi } from 'vitest';
import { createSignal, updateSignal } from './lattice-adapter';

describe('lattice-adapter', () => {
  describe('createSignal', () => {
    it('creates read-only signals', () => {
      const count = createSignal(0);
      
      // Read works
      expect(count()).toBe(0);
      
      // Write throws error
      expect(() => (count as any)(5)).toThrow('Invalid signal operation');
    });
    
    it('supports subscriptions', () => {
      const count = createSignal(0);
      const listener = vi.fn();
      
      const unsubscribe = count.subscribe(listener);
      
      // Update triggers listener
      updateSignal(count, 1);
      expect(listener).toHaveBeenCalledTimes(1);
      
      // Another update
      updateSignal(count, 2);
      expect(listener).toHaveBeenCalledTimes(2);
      
      // Unsubscribe works
      unsubscribe();
      updateSignal(count, 3);
      expect(listener).toHaveBeenCalledTimes(2);
    });
    
    it('handles multiple subscribers', () => {
      const count = createSignal(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      const unsub1 = count.subscribe(listener1);
      const unsub2 = count.subscribe(listener2);
      
      updateSignal(count, 1);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      
      // Unsubscribe first listener
      unsub1();
      updateSignal(count, 2);
      expect(listener1).toHaveBeenCalledTimes(1); // No more calls
      expect(listener2).toHaveBeenCalledTimes(2); // Still gets called
      
      unsub2();
    });
  });
  
  describe('updateSignal', () => {
    it('updates signal values', () => {
      const count = createSignal(0);
      
      updateSignal(count, 5);
      expect(count()).toBe(5);
    });
    
    it('supports updater functions', () => {
      const count = createSignal(10);
      
      updateSignal(count, prev => prev + 1);
      expect(count()).toBe(11);
      
      updateSignal(count, prev => prev * 2);
      expect(count()).toBe(22);
    });
    
    it('throws for invalid signals', () => {
      const notASignal = {} as any;
      expect(() => updateSignal(notASignal, 5)).toThrow('Invalid signal');
    });
    
    it('works with objects', () => {
      const user = createSignal({ name: 'Alice', age: 30 });
      
      updateSignal(user, { name: 'Bob', age: 25 });
      expect(user()).toEqual({ name: 'Bob', age: 25 });
      
      updateSignal(user, prev => ({ ...prev, age: prev.age + 1 }));
      expect(user()).toEqual({ name: 'Bob', age: 26 });
    });
    
    it('works with arrays', () => {
      const items = createSignal([1, 2, 3]);
      
      updateSignal(items, [4, 5, 6]);
      expect(items()).toEqual([4, 5, 6]);
      
      updateSignal(items, prev => [...prev, 7]);
      expect(items()).toEqual([4, 5, 6, 7]);
    });
  });
});
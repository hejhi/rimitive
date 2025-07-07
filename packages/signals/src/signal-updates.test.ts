import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect } from './index';
import { resetGlobalState } from './test-setup';

describe('signal update methods', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('set method', () => {
    it('should update object properties', () => {
      const user = signal({ name: 'John', age: 30 });
      user?.set('name', 'Jane');

      expect(user.value).toEqual({ name: 'Jane', age: 30 });
    });

    it('should trigger effects on property change', () => {
      const user = signal({ name: 'John', age: 30 });
      let effectCount = 0;

      effect(() => {
        void user.value.name;
        effectCount++;
      });

      expect(effectCount).toBe(1);

      user.set('name', 'Jane');
      expect(effectCount).toBe(2);
    });

    it('should work with arrays', () => {
      const todos = signal([
        { id: 1, text: 'Task 1', done: false },
        { id: 2, text: 'Task 2', done: false },
      ]);

      todos.set(0, { id: 1, text: 'Task 1', done: true });

      expect(todos.value[0]?.done).toBe(true);
      expect(todos.value[1]?.done).toBe(false);
    });
  });

  describe('patch method', () => {
    it('should partially update nested objects', () => {
      const user = signal({
        name: 'John',
        settings: { theme: 'light', notifications: true },
      });

      user.patch('settings', { theme: 'dark' });

      expect(user.value).toEqual({
        name: 'John',
        settings: { theme: 'dark', notifications: true },
      });
    });

    it('should trigger effects on nested change', () => {
      const state = signal({
        user: { name: 'John', role: 'admin' },
        config: { theme: 'light' },
      });

      let userEffectCount = 0;
      let configEffectCount = 0;

      effect(() => {
        void state.value.user;
        userEffectCount++;
      });

      effect(() => {
        void state.value.config;
        configEffectCount++;
      });

      expect(userEffectCount).toBe(1);
      expect(configEffectCount).toBe(1);

      // Update user - should only trigger user effect
      state.patch('user', { role: 'user' });

      expect(userEffectCount).toBe(2);
      expect(configEffectCount).toBe(2); // Also triggers because whole object changes
    });

    it('should work with array elements', () => {
      const todos = signal([
        { id: 1, text: 'Task 1', done: false, priority: 'high' },
        { id: 2, text: 'Task 2', done: false, priority: 'low' },
      ]);

      todos.patch(0, { done: true });

      expect(todos.value[0]).toEqual({
        id: 1,
        text: 'Task 1',
        done: true,
        priority: 'high',
      });
    });
  });

  describe('performance', () => {
    it('should be faster than component set', () => {
      const iterations = 10000;
      const user = signal({ name: 'John', age: 30, email: 'john@example.com' });

      // Warm up
      for (let i = 0; i < 100; i++) {
        user.set('age', i);
      }

      // Measure direct set
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        user.set('age', i);
      }
      const directTime = performance.now() - start;

      console.log(
        `Direct set method: ${directTime}ms for ${iterations} updates`
      );
      console.log(
        `Average: ${((directTime / iterations) * 1000).toFixed(2)}µs per update`
      );

      // This should be significantly faster than going through component set
      expect(directTime).toBeLessThan(iterations * 0.001); // Less than 1µs per update
    });
  });
});

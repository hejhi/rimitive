import { describe, it, expect, vi } from 'vitest';
import { createSignalAPI } from './api';
import { createDefaultContext } from './default-context';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createReactiveFactory } from './reactive';

describe('reactive proxy', () => {
  function createTestAPI() {
    return createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      reactive: createReactiveFactory,
    }, createDefaultContext());
  }

  it('should create a reactive proxy', () => {
    const api = createTestAPI();
    const state = api.reactive({ count: 0 });
    
    expect(state.count).toBe(0);
    state.count = 1;
    expect(state.count).toBe(1);
  });

  it('should track dependencies in effects', () => {
    const api = createTestAPI();
    const state = api.reactive({ count: 0 });
    const fn = vi.fn();
    
    api.effect(() => {
      fn(state.count);
    });
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);
    
    state.count = 1;
    
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(1);
  });

  it('should provide fine-grained reactivity', () => {
    const api = createTestAPI();
    const state = api.reactive({
      user: { name: 'John', age: 30 },
      settings: { theme: 'dark' }
    });
    
    const nameFn = vi.fn();
    const ageFn = vi.fn();
    const themeFn = vi.fn();
    
    api.effect(() => { nameFn(state.user.name); });
    api.effect(() => { ageFn(state.user.age); });
    api.effect(() => { themeFn(state.settings.theme); });
    
    expect(nameFn).toHaveBeenCalledTimes(1);
    expect(ageFn).toHaveBeenCalledTimes(1);
    expect(themeFn).toHaveBeenCalledTimes(1);
    
    // Only name effect should run
    state.user.name = 'Jane';
    expect(nameFn).toHaveBeenCalledTimes(2);
    expect(ageFn).toHaveBeenCalledTimes(1);
    expect(themeFn).toHaveBeenCalledTimes(1);
    
    // Only age effect should run
    state.user.age = 31;
    expect(nameFn).toHaveBeenCalledTimes(2);
    expect(ageFn).toHaveBeenCalledTimes(2);
    expect(themeFn).toHaveBeenCalledTimes(1);
    
    // Only theme effect should run
    state.settings.theme = 'light';
    expect(nameFn).toHaveBeenCalledTimes(2);
    expect(ageFn).toHaveBeenCalledTimes(2);
    expect(themeFn).toHaveBeenCalledTimes(2);
  });

  it('should work with computed values', () => {
    const api = createTestAPI();
    const state = api.reactive({
      firstName: 'John',
      lastName: 'Doe'
    });
    
    const fullName = api.computed(() => `${state.firstName} ${state.lastName}`);
    
    expect(fullName.value).toBe('John Doe');
    
    state.firstName = 'Jane';
    expect(fullName.value).toBe('Jane Doe');
    
    state.lastName = 'Smith';
    expect(fullName.value).toBe('Jane Smith');
  });

  it('should handle nested updates', () => {
    const api = createTestAPI();
    const state = api.reactive({
      deeply: {
        nested: {
          value: 'initial'
        }
      }
    });
    
    const fn = vi.fn();
    api.effect(() => { fn(state.deeply.nested.value); });
    
    expect(fn).toHaveBeenCalledWith('initial');
    
    state.deeply.nested.value = 'updated';
    expect(fn).toHaveBeenCalledWith('updated');
  });

  it('should support dynamic property addition', () => {
    const api = createTestAPI();
    interface DynamicState {
      existing: string;
      dynamic?: string;
    }
    const state = api.reactive<DynamicState>({ existing: 'value' });
    
    const fn = vi.fn();
    api.effect(() => {
      if ('dynamic' in state) {
        fn(state.dynamic);
      }
    });
    
    expect(fn).not.toHaveBeenCalled();
    
    state.dynamic = 'new value';
    expect(fn).toHaveBeenCalledWith('new value');
  });

  it('should batch updates', () => {
    const api = createTestAPI();
    const state = api.reactive({
      a: 1,
      b: 2,
      c: 3
    });
    
    const fn = vi.fn();
    api.effect(() => {
      fn(state.a + state.b + state.c);
    });
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(6);
    
    api.batch(() => {
      state.a = 10;
      state.b = 20;
      state.c = 30;
    });
    
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(60);
  });

  it('should handle array mutations', () => {
    const api = createTestAPI();
    const state = api.reactive({
      items: ['a', 'b', 'c'] as string[]
    });
    
    const fn = vi.fn();
    api.effect(() => { fn(state.items.length); });
    
    expect(fn).toHaveBeenCalledWith(3);
    
    // For length changes, need to replace entire array or use a workaround
    // Create a new reactive array with the updated content
    const newItems = [...state.items, 'd'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (state as any).items = newItems;
    expect(fn).toHaveBeenCalledWith(4);
    
    // Direct index assignment works
    const itemFn = vi.fn();
    api.effect(() => { itemFn(state.items[0]); });
    expect(itemFn).toHaveBeenCalledWith('a');
    
    state.items[0] = 'A';
    expect(itemFn).toHaveBeenCalledWith('A');
    expect(fn).toHaveBeenCalledTimes(2); // Length didn't change
  });

  it('should not trigger on same value assignment', () => {
    const api = createTestAPI();
    const state = api.reactive({ value: 'test' });
    
    const fn = vi.fn();
    api.effect(() => { fn(state.value); });
    
    expect(fn).toHaveBeenCalledTimes(1);
    
    state.value = 'test'; // Same value
    expect(fn).toHaveBeenCalledTimes(1); // Should not trigger
    
    state.value = 'changed';
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle property deletion', () => {
    const api = createTestAPI();
    interface DeletableState {
      a: number;
      b?: number;
    }
    const state = api.reactive<DeletableState>({ a: 1, b: 2 });
    
    const fn = vi.fn();
    api.effect(() => {
      fn('b' in state);
    });
    
    expect(fn).toHaveBeenCalledWith(true);
    
    delete state.b;
    expect(fn).toHaveBeenCalledWith(false);
  });

  it('should maintain object identity for nested objects', () => {
    const api = createTestAPI();
    const state = api.reactive({
      nested: { value: 1 }
    });
    
    const first = state.nested;
    const second = state.nested;
    
    expect(first).toBe(second);
  });
});
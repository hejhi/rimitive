import { describe, expect, it } from 'vitest';
import { createLatticeStore } from './runtime';
import { compose } from './compose';
import type { StoreAdapter, RuntimeSliceFactory } from './index';

describe('compose with createStore', () => {
  // Helper to create a test adapter
  const createTestAdapter = <State>(initialState: State): StoreAdapter<State> => {
    let state = { ...initialState };
    const listeners = new Set<() => void>();
    
    return {
      getState: () => state,
      setState: (updates) => {
        state = { ...state, ...updates };
        listeners.forEach(listener => listener());
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  it('should allow composing slices with dependencies', () => {
    type State = { count: number; multiplier: number };
    
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {

      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      const settings = createSlice(({ get, set }) => ({
        multiplier: () => get().multiplier,
        setMultiplier: (value: number) => set({ multiplier: value }),
      }));

      const actions = createSlice(
        compose({ counter, settings }, ({ set }, { counter, settings }) => ({
          incrementByMultiplier: () => {
            const newCount = counter.count() + settings.multiplier();
            set({ count: newCount });
          },
          doubleAndIncrement: () => {
            settings.setMultiplier(settings.multiplier() * 2);
            counter.increment();
          },
        }))
      );

      return { counter, settings, actions };
    };

    const adapter = createTestAdapter({ count: 0, multiplier: 2 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    expect(component.counter.selector.count()).toBe(0);
    expect(component.settings.selector.multiplier()).toBe(2);

    component.actions.selector.incrementByMultiplier();
    expect(component.counter.selector.count()).toBe(2); // 0 + 2

    component.actions.selector.doubleAndIncrement();
    expect(component.settings.selector.multiplier()).toBe(4); // 2 * 2
    expect(component.counter.selector.count()).toBe(3); // 2 + 1
  });

  it('should provide access to tools in composed slices', () => {
    type State = { items: string[]; lastAction: string };
    
    const createComponent = (createSlice: RuntimeSliceFactory<State>) => {

      const items = createSlice(({ get, set }) => ({
        add: (item: string) => {
          set({
            items: [...get().items, item],
            lastAction: `added ${item}`,
          });
        },
        list: () => get().items,
      }));

      const logger = createSlice(({ get }) => ({
        lastAction: () => get().lastAction,
      }));

      const composed = createSlice(
        compose({ items, logger }, ({ get }, { items, logger }) => ({
          addWithLog: (item: string) => {
            items.add(item);
            return `${logger.lastAction()} (${get().items.length} total)`;
          },
        }))
      );

      return { items, logger, composed };
    };

    const adapter = createTestAdapter({ items: [] as string[], lastAction: '' });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    const result = component.composed.selector.addWithLog('apple');
    expect(result).toBe('added apple (1 total)');
    expect(component.items.selector.list()).toEqual(['apple']);
  });
});

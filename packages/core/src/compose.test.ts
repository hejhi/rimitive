import { describe, expect, it } from 'vitest';
import { createStore } from './index';
import { compose } from './compose';

describe('compose with createStore', () => {
  it('should allow composing slices with dependencies', () => {
    const createSlice = createStore({ count: 0, multiplier: 2 });

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

    expect(counter.count()).toBe(0);
    expect(settings.multiplier()).toBe(2);

    actions.incrementByMultiplier();
    expect(counter.count()).toBe(2); // 0 + 2

    actions.doubleAndIncrement();
    expect(settings.multiplier()).toBe(4); // 2 * 2
    expect(counter.count()).toBe(3); // 2 + 1
  });

  it('should provide access to tools in composed slices', () => {
    const createSlice = createStore({ items: [] as string[], lastAction: '' });

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

    const result = composed.addWithLog('apple');
    expect(result).toBe('added apple (1 total)');
    expect(items.list()).toEqual(['apple']);
  });
});

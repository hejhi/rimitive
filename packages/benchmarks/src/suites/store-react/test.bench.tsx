import { describe, bench } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createStoreContext, useStore } from '@lattice/store/react';
import { act } from 'react';

describe('React TESTERT', () => {
  {
    const setup = () =>
      renderHook(() => {
        const store = useStore<{
          count: number;
          text: string;
          items: string[];
          increment: () => void;
          updateText: (text: string) => void;
          addItem: (item: string) => void;
        }>((set, get) => ({
          count: 0,
          text: '',
          items: [],
          increment: () => set({ count: get().count + 1 }),
          updateText: (text) => set({ text }),
          addItem: (item) => set({ items: [...get().items, item] }),
        }));
        return store;
      });
    let hook: ReturnType<typeof setup>;

    bench(
      '@lattice/store-react - multiple state updates',
      () => {
        act(() => {
          // Multiple different state updates
          for (let i = 0; i < 100; i++) {
            hook.result.current.increment();
            hook.result.current.updateText(`text-${i}`);
            if (i % 10 === 0) {
              hook.result.current.addItem(`item-${i}`);
            }
          }
        });
      },
      {
        setup: () => {
          hook = setup();
        },
      }
    );
  }

  {
    const setup = () => {
      type TestStore = {
        count: number;
        nested: {
          value: string;
          items: number[];
        };
        increment: () => void;
        updateNested: (value: string) => void;
        addItem: (item: number) => void;
      };

      createStoreContext<TestStore>();
      createStoreContext<TestStore>();
      createStoreContext<TestStore>();

      return [
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store1', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store2', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
        renderHook(() =>
          useStore<TestStore>((set, get) => ({
            count: 0,
            nested: { value: 'store3', items: [] },
            increment: () => set({ count: get().count + 1 }),
            updateNested: (value) =>
              set({
                nested: { ...get().nested, value },
              }),
            addItem: (item) =>
              set({
                nested: {
                  ...get().nested,
                  items: [...get().nested.items, item],
                },
              }),
          }))
        ),
      ];
    };

    let hooks: ReturnType<typeof setup>;

    bench(
      'multiple store contexts - independent stores',
      () => {
        act(() => {
          hooks.forEach((hook, i) => {
            hook.result.current.increment();
            hook.result.current.updateNested(`updated-${i}`);
            hook.result.current.addItem(i);
          });
        });
      },
      {
        setup: () => {
          hooks = setup();
        },
      }
    );
  }
});

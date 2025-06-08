/**
 * Test compose() with Zustand adapter
 */

import { describe, it, expect } from 'vitest';
import { createModel, createSlice, compose } from '@lattice/core';
import { createZustandAdapter } from './index';

describe('compose with zustand adapter', () => {
  it('should work with composed slices', () => {
    const component = () => {
      const model = createModel<{
        count: number;
        increment: () => void;
        user: { name: string; role: string };
        disabled: boolean;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        user: { name: 'Alice', role: 'admin' },
        disabled: false,
      }));

      const actions = createSlice(model, (m) => ({
        increment: m().increment,
      }));

      const userSlice = createSlice(model, (m) => ({
        name: m().user.name,
        role: m().user.role,
      }));

      const buttonSlice = createSlice(
        model,
        compose({ actions, userSlice }, (m, { actions, userSlice }) => ({
          onClick: actions.increment,
          disabled: m.disabled,
          'aria-label': `Increment (${userSlice.name})`,
        }))
      );

      return {
        model,
        actions,
        views: { button: buttonSlice },
      };
    };

    const store = createZustandAdapter(component);

    // Get initial view
    const button = store.views.button();
    expect(button.disabled).toBe(false);
    expect(button['aria-label']).toBe('Increment (Alice)');
    expect(typeof button.onClick).toBe('function');

    // Increment should work
    button.onClick();

    // Check that count incremented (need to check through actions or a view that exposes count)
    // Since we don't have a count view, let's add one
    const componentWithCount = () => {
      const base = component();
      return {
        ...base,
        views: {
          ...base.views,
          count: createSlice(base.model, (m) => ({ value: m().count })),
        },
      };
    };

    const storeWithCount = createZustandAdapter(componentWithCount);
    expect(storeWithCount.views.count().value).toBe(0);

    storeWithCount.views.button().onClick();
    expect(storeWithCount.views.count().value).toBe(1);
  });

  it('should handle reactive updates with composed slices', () => {
    const component = () => {
      const model = createModel<{
        filter: 'all' | 'active' | 'completed';
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }>(({ set }) => ({
        filter: 'all',
        setFilter: (filter) => set({ filter }),
      }));

      const actions = createSlice(model, (m) => ({
        setFilter: m().setFilter,
      }));

      const stateSlice = createSlice(model, (m) => ({
        filter: m().filter,
      }));

      // Compose to create filter buttons
      const filterButtons = createSlice(
        model,
        compose({ actions, state: stateSlice }, (m, { actions, state }) => ({
          all: {
            onClick: () => actions.setFilter('all'),
            active: m.filter === 'all',
          },
          active: {
            onClick: () => actions.setFilter('active'),
            active: state.filter === 'active',
          },
          completed: {
            onClick: () => actions.setFilter('completed'),
            active: state.filter === 'completed',
          },
        }))
      );

      return {
        model,
        actions,
        views: { filterButtons, state: stateSlice },
      };
    };

    const store = createZustandAdapter(component);

    // Initial state
    let buttons = store.views.filterButtons();
    expect(buttons.all.active).toBe(true);
    expect(buttons.active.active).toBe(false);
    expect(buttons.completed.active).toBe(false);

    // Click active button
    buttons.active.onClick();

    // Check reactive update
    buttons = store.views.filterButtons();
    expect(buttons.all.active).toBe(false);
    expect(buttons.active.active).toBe(true);
    expect(buttons.completed.active).toBe(false);

    // Verify state changed
    expect(store.views.state().filter).toBe('active');
  });

  it('should work with nested compose', () => {
    const component = () => {
      const model = createModel<{
        x: number;
        y: number;
        op: 'add' | 'multiply';
        setOp: (op: 'add' | 'multiply') => void;
      }>(({ set }) => ({
        x: 5,
        y: 3,
        op: 'add',
        setOp: (op) => set({ op }),
      }));

      const xySlice = createSlice(model, (m) => ({
        x: m().x,
        y: m().y,
      }));

      const opSlice = createSlice(model, (m) => ({
        operation: m().op,
      }));

      // First level compose
      const resultSlice = createSlice(
        model,
        compose({ xy: xySlice, op: opSlice }, (_, { xy, op }) => ({
          result: op.operation === 'add' ? xy.x + xy.y : xy.x * xy.y,
        }))
      );

      // Second level compose using first
      const displaySlice = createSlice(
        model,
        compose(
          { result: resultSlice, xy: xySlice, op: opSlice },
          (_, { result, xy, op }) => ({
            text: `${xy.x} ${op.operation === 'add' ? '+' : '×'} ${xy.y} = ${result.result}`,
          })
        )
      );

      return {
        model,
        actions: createSlice(model, (m) => ({ setOp: m().setOp })),
        views: { display: displaySlice },
      };
    };

    const store = createZustandAdapter(component);

    // Initial state (add)
    expect(store.views.display().text).toBe('5 + 3 = 8');

    // Change operation
    store.actions.setOp('multiply');
    expect(store.views.display().text).toBe('5 × 3 = 15');
  });
});

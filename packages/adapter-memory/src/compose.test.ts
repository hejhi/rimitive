/**
 * Test compose() with Memory adapter
 */

import { describe, it, expect } from 'vitest';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import { createMemoryAdapter } from './index';

describe('compose with memory adapter', () => {
  it('should work with composed slices', () => {
    const component = createComponent(() => {
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
        increment: m.increment,
      }));

      const userSlice = createSlice(model, (m) => ({
        name: m.user.name,
        role: m.user.role,
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
    });

    const adapter = createMemoryAdapter(component);

    // Get initial view
    const button = adapter.views.button();
    expect(button.disabled).toBe(false);
    expect(button['aria-label']).toBe('Increment (Alice)');
    expect(typeof button.onClick).toBe('function');

    // Increment should work
    button.onClick();

    // Check the count through the adapter's getState
    expect(adapter.getState().count).toBe(1);

    // Button view should still work
    const button2 = adapter.views.button();
    expect(button2['aria-label']).toBe('Increment (Alice)');
  });

  it('should handle reactive updates with composed slices', () => {
    const component = createComponent(() => {
      const model = createModel<{
        filter: 'all' | 'active' | 'completed';
        setFilter: (filter: 'all' | 'active' | 'completed') => void;
      }>(({ set }) => ({
        filter: 'all',
        setFilter: (filter) => set({ filter }),
      }));

      const actions = createSlice(model, (m) => ({
        setFilter: m.setFilter,
      }));

      const stateSlice = createSlice(model, (m) => ({
        filter: m.filter,
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
    });

    const adapter = createMemoryAdapter(component);

    // Initial state
    let buttons = adapter.views.filterButtons();
    expect(buttons.all.active).toBe(true);
    expect(buttons.active.active).toBe(false);
    expect(buttons.completed.active).toBe(false);

    // Click active button
    buttons.active.onClick();

    // Check reactive update
    buttons = adapter.views.filterButtons();
    expect(buttons.all.active).toBe(false);
    expect(buttons.active.active).toBe(true);
    expect(buttons.completed.active).toBe(false);

    // Verify state changed
    expect(adapter.views.state().filter).toBe('active');
  });

  it('should work with nested compose', () => {
    const component = createComponent(() => {
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
        x: m.x,
        y: m.y,
      }));

      const opSlice = createSlice(model, (m) => ({
        operation: m.op,
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
        actions: createSlice(model, (m) => ({ setOp: m.setOp })),
        views: { display: displaySlice },
      };
    });

    const adapter = createMemoryAdapter(component);

    // Initial state (add)
    expect(adapter.views.display().text).toBe('5 + 3 = 8');

    // Change operation
    adapter.actions.setOp('multiply');
    expect(adapter.views.display().text).toBe('5 × 3 = 15');
  });

  it('should handle complex composition patterns', () => {
    const component = createComponent(() => {
      const model = createModel<{
        items: Array<{ id: number; name: string; completed: boolean }>;
        selectedId: number | null;
        toggleItem: (id: number) => void;
        selectItem: (id: number | null) => void;
      }>(({ set, get }) => ({
        items: [
          { id: 1, name: 'Task 1', completed: false },
          { id: 2, name: 'Task 2', completed: true },
          { id: 3, name: 'Task 3', completed: false },
        ],
        selectedId: null,
        toggleItem: (id) =>
          set({
            items: get().items.map((item) =>
              item.id === id ? { ...item, completed: !item.completed } : item
            ),
          }),
        selectItem: (id) => set({ selectedId: id }),
      }));

      const itemsSlice = createSlice(model, (m) => ({
        items: m.items,
        selectedId: m.selectedId,
      }));

      const actionsSlice = createSlice(model, (m) => ({
        toggleItem: m.toggleItem,
        selectItem: m.selectItem,
      }));

      // Complex composition with computed values
      const statsSlice = createSlice(
        model,
        compose({ items: itemsSlice }, (_, { items }) => {
          const completed = items.items.filter((i) => i.completed);
          const active = items.items.filter((i) => !i.completed);
          return {
            total: items.items.length,
            completedCount: completed.length,
            activeCount: active.length,
            allCompleted: active.length === 0,
          };
        })
      );

      // View that combines stats and actions
      const summarySlice = createSlice(
        model,
        compose(
          { stats: statsSlice, actions: actionsSlice },
          (_, { stats }) => ({
            text: `${stats.activeCount} of ${stats.total} remaining`,
            className: stats.allCompleted ? 'all-done' : 'in-progress',
            onCompleteAll: () => {
              // This would normally be a separate action, simplified for test
              console.log('Complete all clicked');
            },
          })
        )
      );

      return {
        model,
        actions: actionsSlice,
        views: {
          stats: statsSlice,
          summary: summarySlice,
        },
      };
    });

    const adapter = createMemoryAdapter(component);

    // Initial state
    expect(adapter.views.stats().activeCount).toBe(2);
    expect(adapter.views.stats().completedCount).toBe(1);
    expect(adapter.views.summary().text).toBe('2 of 3 remaining');
    expect(adapter.views.summary().className).toBe('in-progress');

    // Toggle an item
    adapter.actions.toggleItem(1);
    expect(adapter.views.stats().activeCount).toBe(1);
    expect(adapter.views.stats().completedCount).toBe(2);
    expect(adapter.views.summary().text).toBe('1 of 3 remaining');

    // Complete all
    adapter.actions.toggleItem(3);
    expect(adapter.views.stats().allCompleted).toBe(true);
    expect(adapter.views.summary().className).toBe('all-done');
  });
});

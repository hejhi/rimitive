/**
 * @fileoverview Core composition performance benchmarks
 * 
 * Tests the performance of Lattice's core composition patterns including:
 * - Slice creation and execution
 * - Compose function performance
 * - Model creation overhead
 * - Component factory performance
 */

import { bench, describe } from 'vitest';
import { createModel, createSlice, compose, createComponent } from '@lattice/core';

describe('Core Composition Performance', () => {
  // Test data
  const largeModel = createModel<{
    items: Array<{ id: number; name: string; value: number }>;
    filter: string;
    sortBy: 'name' | 'value';
    count: number;
    increment: () => void;
  }>(({ set, get }) => ({
    items: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 100,
    })),
    filter: '',
    sortBy: 'name',
    count: 0,
    increment: () => set({ count: get().count + 1 }),
  }));

  bench('createSlice - simple state access', () => {
    const slice = createSlice(largeModel, (m) => ({
      count: m.count,
      filter: m.filter,
    }));
    
    // Execute the slice
    slice({ count: 42, filter: 'test', sortBy: 'name', items: [], increment: () => {} });
  });

  bench('createSlice - complex computation', () => {
    const slice = createSlice(largeModel, (m) => {
      const filtered = m.items.filter((item) =>
        item.name.toLowerCase().includes(m.filter.toLowerCase())
      );
      
      const sorted = [...filtered].sort((a, b) => {
        if (m.sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return a.value - b.value;
      });
      
      return {
        items: sorted,
        totalValue: sorted.reduce((sum, item) => sum + item.value, 0),
        count: sorted.length,
      };
    });
    
    // Execute with test data
    const testModel = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 100,
      })),
      filter: 'Item 1',
      sortBy: 'value' as const,
      count: 0,
      increment: () => {},
    };
    
    slice(testModel);
  });

  bench('compose - single dependency', () => {
    const baseSlice = createSlice(largeModel, (m) => ({
      items: m.items,
      filter: m.filter,
    }));
    
    const composed = createSlice(
      largeModel,
      compose({ base: baseSlice }, (m, { base }) => ({
        itemCount: base.items.length,
        hasFilter: base.filter.length > 0,
        firstItem: base.items[0],
      }))
    );
    
    // Execute
    const testModel = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: i,
      })),
      filter: 'test',
      sortBy: 'name' as const,
      count: 0,
      increment: () => {},
    };
    
    composed(testModel);
  });

  bench('compose - multiple dependencies', () => {
    const itemsSlice = createSlice(largeModel, (m) => m.items);
    const filterSlice = createSlice(largeModel, (m) => m.filter);
    const sortSlice = createSlice(largeModel, (m) => m.sortBy);
    
    const composed = createSlice(
      largeModel,
      compose(
        { items: itemsSlice, filter: filterSlice, sort: sortSlice },
        (m, { items, filter, sort }) => {
          const filtered = items.filter((item) =>
            item.name.includes(filter)
          );
          
          return {
            results: filtered,
            count: filtered.length,
            sortedBy: sort,
          };
        }
      )
    );
    
    // Execute
    const testModel = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: i,
      })),
      filter: 'Item',
      sortBy: 'name' as const,
      count: 0,
      increment: () => {},
    };
    
    composed(testModel);
  });

  bench('compose - deep nesting (3 levels)', () => {
    const level1 = createSlice(largeModel, (m) => ({ count: m.count }));
    
    const level2 = createSlice(
      largeModel,
      compose({ l1: level1 }, (m, { l1 }) => ({
        doubled: l1.count * 2,
        original: l1.count,
      }))
    );
    
    const level3 = createSlice(
      largeModel,
      compose({ l2: level2 }, (m, { l2 }) => ({
        quadrupled: l2.doubled * 2,
        summary: `Count: ${l2.original}, Doubled: ${l2.doubled}`,
      }))
    );
    
    // Execute
    const testModel = {
      items: [],
      filter: '',
      sortBy: 'name' as const,
      count: 42,
      increment: () => {},
    };
    
    level3(testModel);
  });

  bench('createComponent - full component creation', () => {
    createComponent(() => {
      const model = createModel<{
        todos: Array<{ id: number; text: string; done: boolean }>;
        filter: 'all' | 'active' | 'completed';
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
      }>(({ set, get }) => ({
        todos: [],
        filter: 'all',
        addTodo: (text) => {
          const { todos } = get();
          set({
            todos: [...todos, { id: Date.now(), text, done: false }],
          });
        },
        toggleTodo: (id) => {
          const { todos } = get();
          set({
            todos: todos.map((todo) =>
              todo.id === id ? { ...todo, done: !todo.done } : todo
            ),
          });
        },
      }));

      const actions = createSlice(model, (m) => ({
        addTodo: m.addTodo,
        toggleTodo: m.toggleTodo,
      }));

      const todosView = createSlice(model, (m) => {
        const todos =
          m.filter === 'all'
            ? m.todos
            : m.filter === 'active'
            ? m.todos.filter((t) => !t.done)
            : m.todos.filter((t) => t.done);

        return { todos, count: todos.length };
      });

      const filterButtons = createSlice(
        model,
        compose({ actions }, (m, { actions }) => ({
          all: { active: m.filter === 'all' },
          active: { active: m.filter === 'active' },
          completed: { active: m.filter === 'completed' },
        }))
      );

      return {
        model,
        actions,
        views: {
          todos: todosView,
          filters: filterButtons,
        },
      };
    });
  });

  bench('slice execution - 1000 sequential calls', () => {
    const slice = createSlice(largeModel, (m) => ({
      count: m.count,
      isEven: m.count % 2 === 0,
    }));
    
    const testModel = {
      items: [],
      filter: '',
      sortBy: 'name' as const,
      count: 0,
      increment: () => {},
    };
    
    for (let i = 0; i < 1000; i++) {
      testModel.count = i;
      slice(testModel);
    }
  });

  bench('compose execution - 1000 sequential calls', () => {
    const base = createSlice(largeModel, (m) => ({ value: m.count }));
    const composed = createSlice(
      largeModel,
      compose({ base }, (m, { base }) => ({
        doubled: base.value * 2,
      }))
    );
    
    const testModel = {
      items: [],
      filter: '',
      sortBy: 'name' as const,
      count: 0,
      increment: () => {},
    };
    
    for (let i = 0; i < 1000; i++) {
      testModel.count = i;
      composed(testModel);
    }
  });
});
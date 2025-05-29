import { describe, it, expect, vi } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createComponent, createSlice } from '@lattice/core';

describe('Memory Adapter - Model Factory Interface', () => {
  /**
   * Tests that verify the model factory receives the correct get/set interface
   * as specified in the adapter architecture spec:
   *
   * "const model = spec.model({
   *    get: () => modelStore.get(),
   *    set: (updates) => modelStore.set(prev => ({ ...prev, ...updates }))
   * });"
   */
  describe('model factory get/set interface', () => {
    it('should provide get() function that returns current state', () => {
      const modelFactory = vi.fn(
        (tools: { get: () => any; set: (updates: any) => void }) => {
          // Verify get() returns the correct state shape
          const initial = tools.get();
          expect(initial).toEqual({}); // Initial empty state

          return {
            count: 0,
            name: 'test',
            increment: () => {
              const current = tools.get();
              tools.set({ count: current.count + 1 });
            },
          };
        }
      );

      const component = createComponent(() => {
        const model = createModel(modelFactory);
        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Verify model factory was called with get/set
      expect(modelFactory).toHaveBeenCalledWith({
        get: expect.any(Function),
        set: expect.any(Function),
      });

      // Verify state was initialized correctly
      expect(result.model.get()).toEqual({
        count: 0,
        name: 'test',
        increment: expect.any(Function),
      });
    });

    it('should provide set() function that merges updates', () => {
      const setCalls: any[] = [];

      const component = createComponent(() => {
        const model = createModel(({ get, set }) => {
          // Capture how set is used
          const wrappedSet = (updates: any) => {
            setCalls.push(updates);
            set(updates);
          };

          return {
            x: 10,
            y: 20,
            name: 'point',
            moveX: (newX: number) => wrappedSet({ x: newX }),
            moveY: (newY: number) => wrappedSet({ y: newY }),
            moveBoth: (newX: number, newY: number) =>
              wrappedSet({ x: newX, y: newY }),
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            moveX: m.moveX,
            moveY: m.moveY,
            moveBoth: m.moveBoth,
          })),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Test partial updates
      result.actions.get().moveX(30);
      expect(result.model.get()).toEqual({
        x: 30,
        y: 20,
        name: 'point',
        moveX: expect.any(Function),
        moveY: expect.any(Function),
        moveBoth: expect.any(Function),
      });

      result.actions.get().moveY(40);
      expect(result.model.get()).toEqual({
        x: 30,
        y: 40,
        name: 'point',
        moveX: expect.any(Function),
        moveY: expect.any(Function),
        moveBoth: expect.any(Function),
      });

      // Verify set was called with partial updates
      expect(setCalls).toEqual([{ x: 30 }, { y: 40 }]);
    });

    it('should allow model to read its own state during initialization', () => {
      const component = createComponent(() => {
        const model = createModel(({ get, set }) => {
          // Model should be able to call get() during initialization
          const currentState = get();
          expect(currentState).toEqual({}); // Empty initially

          // Create computed initial values based on initial state
          const defaultMultiplier = currentState.multiplier || 2;

          return {
            value: 5,
            multiplier: defaultMultiplier,
            result: 5 * defaultMultiplier,
            compute: () => {
              const state = get();
              set({ result: state.value * state.multiplier });
            },
          };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      expect(result.model.get()).toMatchObject({
        value: 5,
        multiplier: 2,
        result: 10,
      });
    });

    it('should handle complex state updates through get/set', () => {
      interface TodoItem {
        id: number;
        text: string;
        done: boolean;
      }

      const component = createComponent(() => {
        let nextId = 1;

        const model = createModel(({ get, set }) => ({
          todos: [] as TodoItem[],
          filter: 'all' as 'all' | 'active' | 'completed',

          addTodo: (text: string) => {
            const todos = get().todos;
            set({
              todos: [...todos, { id: nextId++, text, done: false }],
            });
          },

          toggleTodo: (id: number) => {
            const todos = get().todos;
            set({
              todos: todos.map((todo) =>
                todo.id === id ? { ...todo, done: !todo.done } : todo
              ),
            });
          },

          removeTodo: (id: number) => {
            const todos = get().todos;
            set({
              todos: todos.filter((todo) => todo.id !== id),
            });
          },

          clearCompleted: () => {
            const todos = get().todos;
            set({
              todos: todos.filter((todo) => !todo.done),
            });
          },

          setFilter: (filter: 'all' | 'active' | 'completed') => {
            set({ filter });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addTodo: m.addTodo,
            toggleTodo: m.toggleTodo,
            removeTodo: m.removeTodo,
            clearCompleted: m.clearCompleted,
            setFilter: m.setFilter,
          })),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const actions = result.actions.get();

      // Add todos
      actions.addTodo('First task');
      actions.addTodo('Second task');

      expect(result.model.get().todos).toHaveLength(2);
      expect(result.model.get().todos[0]).toMatchObject({
        id: 1,
        text: 'First task',
        done: false,
      });

      // Toggle todo
      actions.toggleTodo(1);
      expect(result.model.get().todos[0]?.done).toBe(true);

      // Remove todo
      actions.removeTodo(2);
      expect(result.model.get().todos).toHaveLength(1);

      // Clear completed
      actions.clearCompleted();
      expect(result.model.get().todos).toHaveLength(0);
    });

    it('should handle synchronous get() calls during set() operations', () => {
      const component = createComponent(() => {
        const model = createModel(({ get, set }) => ({
          count: 0,
          history: [] as number[],

          increment: () => {
            const currentCount = get().count;
            const newCount = currentCount + 1;

            // Get history during the update
            const currentHistory = get().history;

            set({
              count: newCount,
              history: [...currentHistory, newCount],
            });
          },

          doubleIncrement: () => {
            // Multiple get/set calls in sequence
            const first = get().count;
            set({ count: first + 1 });

            const second = get().count;
            set({ count: second + 1 });

            // Update history with final value
            const final = get().count;
            const history = get().history;
            set({ history: [...history, final] });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment,
            doubleIncrement: m.doubleIncrement,
          })),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const actions = result.actions.get();

      // Test single increment
      actions.increment();
      expect(result.model.get()).toMatchObject({
        count: 1,
        history: [1],
      });

      // Test double increment
      actions.doubleIncrement();
      expect(result.model.get()).toMatchObject({
        count: 3,
        history: [1, 3],
      });
    });

    it('should not allow set() to completely replace state object', () => {
      const component = createComponent(() => {
        const model = createModel(({ get, set }) => ({
          a: 1,
          b: 2,
          c: 3,

          updateA: (value: number) => {
            // This should merge, not replace
            set({ a: value });
          },

          updateMultiple: () => {
            // Even with multiple properties, should merge
            set({ a: 10, b: 20 });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateA: m.updateA,
            updateMultiple: m.updateMultiple,
          })),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Update single property
      result.actions.get().updateA(100);

      // Other properties should remain
      expect(result.model.get()).toMatchObject({
        a: 100,
        b: 2,
        c: 3,
      });

      // Update multiple properties
      result.actions.get().updateMultiple();

      // Unmentioned property should still remain
      expect(result.model.get()).toMatchObject({
        a: 10,
        b: 20,
        c: 3,
      });
    });
  });

  /**
   * Edge cases and error scenarios for model factory interface
   */
  describe('model factory edge cases', () => {
    it('should handle empty model factory', () => {
      const component = createComponent(() => {
        const model = createModel(() => ({}));
        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      expect(result.model.get()).toEqual({});
    });

    it('should handle model factory that only uses get()', () => {
      const component = createComponent(() => {
        const model = createModel(({ get }) => {
          // Model that only reads, never writes
          const state = get();
          const isEmpty = Object.keys(state).length === 0;

          return {
            wasEmpty: isEmpty,
            timestamp: Date.now(),
          };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      expect(result.model.get()).toMatchObject({
        wasEmpty: true,
        timestamp: expect.any(Number),
      });
    });

    it('should handle recursive state structures', () => {
      interface TreeNode {
        value: number;
        children: TreeNode[];
      }

      const component = createComponent(() => {
        const model = createModel(({ get, set }) => ({
          tree: { value: 1, children: [] } as TreeNode,

          addChild: (parentValue: number, childValue: number) => {
            const tree = get().tree;

            const addToNode = (node: TreeNode): TreeNode => {
              if (node.value === parentValue) {
                return {
                  ...node,
                  children: [
                    ...node.children,
                    { value: childValue, children: [] },
                  ],
                };
              }
              return {
                ...node,
                children: node.children.map(addToNode),
              };
            };

            set({ tree: addToNode(tree) });
          },
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ addChild: m.addChild })),
          views: {},
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      result.actions.get().addChild(1, 2);
      result.actions.get().addChild(1, 3);
      result.actions.get().addChild(2, 4);

      const tree = result.model.get().tree;
      expect(tree.value).toBe(1);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0]?.value).toBe(2);
      expect(tree.children[0]?.children[0]?.value).toBe(4);
    });
  });
});

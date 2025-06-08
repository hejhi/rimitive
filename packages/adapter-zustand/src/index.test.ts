import { describe, it, expect } from 'vitest';
import { createZustandAdapter } from './index';
import { createModel, createSlice, compose } from '@lattice/core';

describe('createZustandAdapter', () => {
  it('should export createZustandAdapter function', () => {
    expect(createZustandAdapter).toBeDefined();
    expect(typeof createZustandAdapter).toBe('function');
  });

  it('should return unified API with actions, views, and subscribe', () => {
    const counter = () => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      const actions = createSlice(model, (m) => ({
        increment: m().increment,
      }));

      const countView = createSlice(model, (m) => ({
        count: m().count,
      }));

      return { model, actions, views: { count: countView } };
    };

    const store = createZustandAdapter(counter);

    // Verify unified API
    expect(store).toBeDefined();
    expect(typeof store.subscribe).toBe('function');
    expect(store.actions).toBeDefined();
    expect(store.views).toBeDefined();

    // Should NOT expose internals
    // @ts-expect-error
    expect(store.setState).toBeUndefined();
    // @ts-expect-error
    expect(store.use).toBeUndefined();

    // Verify initial state through views
    expect(store.views.count().count).toBe(0);

    // Verify actions work
    store.actions.increment();
    expect(store.views.count().count).toBe(1);
  });

  it('should support view-based subscriptions', () => {
    const counter = () => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      const countView = createSlice(model, (m) => ({
        count: m().count,
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m().increment })),
        views: { count: countView },
      };
    };

    const store = createZustandAdapter(counter);

    // Track view changes
    const states: Array<{ count: number }> = [];
    const unsubscribe = store.subscribe(
      (views) => views.count(),
      (state) => states.push(state)
    );

    // Make changes
    store.actions.increment();
    store.actions.increment();

    expect(states.length).toBe(2);
    expect(states[0]!.count).toBe(1);
    expect(states[1]!.count).toBe(2);

    unsubscribe();
  });

  it('should handle vanilla JS usage pattern', () => {
    const counter = () => {
      const model = createModel<{
        count: number;
        multiplier: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        multiplier: 2,
        increment: () => set({ count: get().count + 1 }),
      }));

      const stateView = createSlice(model, (m) => ({
        count: m().count,
        multiplier: m().multiplier,
      }));

      const doubledView = createSlice(model, (m) => {
        const state = stateView(m);
        return {
          doubled: state.count * state.multiplier,
        };
      });

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m().increment })),
        views: {
          state: stateView,
          doubled: doubledView,
        },
      };
    };

    const store = createZustandAdapter(counter);

    // Access state through views
    const state = store.views.state();
    expect(state.count).toBe(0);
    expect(state.multiplier).toBe(2);

    // Use actions
    store.actions.increment();
    expect(store.views.state().count).toBe(1);

    // Use computed view
    const doubled = store.views.doubled();
    expect(doubled.doubled).toBe(2);
  });

  it('should work with React-style usage', () => {
    const counter = () => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      const countView = createSlice(model, (m) => ({
        count: m().count,
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m().increment })),
        views: { count: countView },
      };
    };

    const store = createZustandAdapter(counter);

    // Access current state through views
    const count = store.views.count().count;
    expect(count).toBe(0);

    // Actions are direct methods
    store.actions.increment();
    expect(store.views.count().count).toBe(1);
  });

  it('should handle async actions properly', async () => {
    const counter = () => {
      const model = createModel<{
        count: number;
        loading: boolean;
        incrementAsync: () => Promise<void>;
      }>(({ set, get }) => ({
        count: 0,
        loading: false,
        incrementAsync: async () => {
          set({ loading: true });
          await new Promise((resolve) => setTimeout(resolve, 10));
          set({ count: get().count + 1, loading: false });
        },
      }));

      const stateView = createSlice(model, (m) => ({
        count: m().count,
        loading: m().loading,
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({
          incrementAsync: m().incrementAsync,
        })),
        views: { state: stateView },
      };
    };

    const store = createZustandAdapter(counter);

    expect(store.views.state().count).toBe(0);
    expect(store.views.state().loading).toBe(false);

    // Start async operation
    const promise = store.actions.incrementAsync();
    expect(store.views.state().loading).toBe(true);

    // Wait for completion
    await promise;
    expect(store.views.state().count).toBe(1);
    expect(store.views.state().loading).toBe(false);
  });

  describe('views', () => {
    it('should handle static slice views', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          disabled: boolean;
        }>(() => ({
          count: 5,
          disabled: false,
        }));

        const displaySlice = createSlice(model, (m) => ({
          value: m().count,
          isDisabled: m().disabled,
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { display: displaySlice },
        };
      };

      const componentStore = createZustandAdapter(component);

      // Static view is a hook that returns attributes
      const display = componentStore.views.display();
      expect(display).toEqual({
        value: 5,
        isDisabled: false,
      });
    });

    it('should handle computed view functions', () => {
      const component = () => {
        const model = createModel<{ count: number }>(() => ({ count: 5 }));

        const countSlice = createSlice(model, (m) => ({
          count: m().count,
        }));

        // Create a computed view slice
        const counterView = createSlice(model, (m) => {
          const state = countSlice(m);
          return {
            'data-count': state.count,
            className: state.count % 2 === 0 ? 'even' : 'odd',
            'aria-label': `Count is ${state.count}`,
          };
        });

        const views = { counter: counterView };

        return {
          model,
          actions: createSlice(model, () => ({})),
          views,
        };
      };

      const componentStore = createZustandAdapter(component);

      // Computed view is a hook that returns attributes
      expect(typeof componentStore.views.counter).toBe('function');

      const counterAttrs = componentStore.views.counter();
      expect(counterAttrs).toEqual({
        'data-count': 5,
        className: 'odd',
        'aria-label': 'Count is 5',
      });
    });

    it('should update views reactively when model changes', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countSlice = createSlice(model, (m) => ({
          value: m().count,
          doubled: m().count * 2,
          isEven: m().count % 2 === 0,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        return {
          model,
          actions,
          views: { display: countSlice },
        };
      };

      const componentStore = createZustandAdapter(component);

      // Views update reactively via the model store
      // Initial state
      expect(componentStore.views.display()).toEqual({
        value: 0,
        doubled: 0,
        isEven: true,
      });

      // Update model
      componentStore.actions.increment();

      // View should update
      expect(componentStore.views.display()).toEqual({
        value: 1,
        doubled: 2,
        isEven: false,
      });

      // Another update
      componentStore.actions.increment();
      expect(componentStore.views.display()).toEqual({
        value: 2,
        doubled: 4,
        isEven: true,
      });
    });

    it('should handle views with compose()', () => {
      const component = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
          decrement: m().decrement,
        }));

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            onIncrement: actions.increment,
            onDecrement: actions.decrement,
            count: m.count,
            'aria-label': `Current count: ${m.count}`,
          }))
        );

        return {
          model,
          actions,
          views: { button: buttonSlice },
        };
      };

      const componentStore = createZustandAdapter(component);

      const buttonView = componentStore.views.button();

      expect(buttonView.count).toBe(0);
      expect(buttonView['aria-label']).toBe('Current count: 0');
      expect(typeof buttonView.onIncrement).toBe('function');
      expect(typeof buttonView.onDecrement).toBe('function');

      // Actions should work
      buttonView.onIncrement();
      const updatedCount = componentStore.views.button().count;
      expect(updatedCount).toBe(1);

      buttonView.onDecrement();
      const finalCount = componentStore.views.button().count;
      expect(finalCount).toBe(0);

      // View should update
      const updatedView = componentStore.views.button();
      expect(updatedView['aria-label']).toBe('Current count: 0');
    });

    it('should handle nested compose()', () => {
      const component = () => {
        const model = createModel<{
          user: { id: number; name: string; role: string };
          permissions: { canEdit: boolean; canDelete: boolean };
          updatePermissions: (
            perms: Partial<{ canEdit: boolean; canDelete: boolean }>
          ) => void;
        }>(({ set, get }) => ({
          user: { id: 1, name: 'Alice', role: 'admin' },
          permissions: { canEdit: true, canDelete: false },
          updatePermissions: (perms) =>
            set({
              permissions: { ...get().permissions, ...perms },
            }),
        }));

        const userSlice = createSlice(model, (m) => m().user);
        const permissionsSlice = createSlice(model, (m) => m().permissions);
        const actionsSlice = createSlice(model, (m) => ({
          updatePermissions: m().updatePermissions,
        }));

        const dashboardSlice = createSlice(
          model,
          compose(
            { userSlice, permissionsSlice, actionsSlice },
            (_, { userSlice, permissionsSlice, actionsSlice }) => ({
              userName: userSlice.name,
              userRole: userSlice.role,
              canEdit: permissionsSlice.canEdit,
              canDelete: permissionsSlice.canDelete,
              actions: actionsSlice,
            })
          )
        );

        return {
          model,
          actions: actionsSlice,
          views: { dashboard: dashboardSlice },
        };
      };

      const componentStore = createZustandAdapter(component);

      const dashboardView = componentStore.views.dashboard();

      expect(dashboardView.userName).toBe('Alice');
      expect(dashboardView.userRole).toBe('admin');
      expect(dashboardView.canEdit).toBe(true);
      expect(dashboardView.canDelete).toBe(false);
      expect(typeof dashboardView.actions.updatePermissions).toBe('function');

      // Update permissions
      dashboardView.actions.updatePermissions({ canDelete: true });

      // View should update
      const updatedView = componentStore.views.dashboard();
      expect(updatedView.canDelete).toBe(true);
      expect(updatedView.canEdit).toBe(true); // Unchanged
    });
  });

  describe('vanilla JavaScript usage', () => {
    it('should demonstrate comprehensive vanilla JS usage outside React', () => {
      // This test shows how to use Lattice with vanilla JavaScript
      // Key difference: In React, hooks handle subscriptions automatically
      // In vanilla JS, you manage subscriptions manually for reactivity

      const todoApp = () => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [
            { id: 1, text: 'Learn Lattice', done: false },
            { id: 2, text: 'Build app', done: false },
          ],
          filter: 'all',
          addTodo: (text) => {
            const newTodo = { id: Date.now(), text, done: false };
            set({ todos: [...get().todos, newTodo] });
          },
          toggleTodo: (id) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, done: !todo.done } : todo
              ),
            });
          },
          setFilter: (filter) => set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          addTodo: m().addTodo,
          toggleTodo: m().toggleTodo,
          setFilter: m().setFilter,
        }));

        // View that computes filtered todos
        const filteredTodosSlice = createSlice(model, (m) => {
          const todos = m().todos;
          const filter = m().filter;

          switch (filter) {
            case 'active':
              return todos.filter((t) => !t.done);
            case 'completed':
              return todos.filter((t) => t.done);
            default:
              return todos;
          }
        });

        // View that computes stats
        const statsSlice = createSlice(model, (m) => ({
          total: m().todos.length,
          active: m().todos.filter((t) => !t.done).length,
          completed: m().todos.filter((t) => t.done).length,
        }));

        return {
          model,
          actions,
          views: {
            filteredTodos: filteredTodosSlice,
            stats: statsSlice,
          },
        };
      };

      const store = createZustandAdapter(todoApp);

      // === Direct State Access Through Views ===
      // Views provide access to current state
      const initialState = store.views.filteredTodos();
      expect(initialState).toHaveLength(2);
      const stats = store.views.stats();
      expect(stats.total).toBe(2);

      // === Using Actions ===
      // Actions are direct methods on the adapter
      store.actions.addTodo('Test todo 1');
      expect(store.views.stats().total).toBe(3);

      store.actions.addTodo('Test todo 2');
      expect(store.views.stats().total).toBe(4);

      // === Accessing Views Outside React ===
      // Views are functions that return current values
      const filteredTodos = store.views.filteredTodos();
      expect(filteredTodos).toHaveLength(4); // All todos shown with 'all' filter

      const statsAfterAdd = store.views.stats();
      expect(statsAfterAdd.total).toBe(4);
      expect(statsAfterAdd.active).toBe(4);
      expect(statsAfterAdd.completed).toBe(0);

      // === Manual Subscriptions for Reactivity ===
      // This is the key difference from React - you manage subscriptions yourself

      // Track view changes
      const stateChanges: Array<{ todoCount: number; active: number }> = [];
      const unsubscribeState = store.subscribe(
        (views) => views.stats(),
        (stats) => {
          stateChanges.push({
            todoCount: stats.total,
            active: stats.active,
          });
        }
      );

      // Track filtered todos changes
      const viewChanges: number[] = [];
      const unsubscribeView = store.subscribe(
        (views) => views.filteredTodos(),
        (todos) => {
          viewChanges.push(todos.length);
        }
      );

      // Make changes
      store.actions.toggleTodo(1); // Mark first todo as done

      // Verify subscriptions fired
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toEqual({ todoCount: 4, active: 3 });
      expect(viewChanges).toHaveLength(1);
      expect(viewChanges[0]).toBe(4); // Still 4 todos shown with 'all' filter

      // === Using Views for Computed Values ===
      // Create a custom view for specific data
      const getActiveTodoTexts = () => {
        const todos = store.views.filteredTodos();
        // When filter is 'all', we need to filter manually
        return todos.filter((t) => !t.done).map((t) => t.text);
      };

      const activeTodoTexts = getActiveTodoTexts();
      expect(activeTodoTexts).toEqual([
        'Build app',
        'Test todo 1',
        'Test todo 2',
      ]);

      // === Filtering Example ===
      store.actions.setFilter('active');

      // Views update automatically
      expect(store.views.filteredTodos()).toHaveLength(3); // Only active todos

      store.actions.setFilter('completed');
      expect(store.views.filteredTodos()).toHaveLength(1); // Only completed todos

      // === Cleanup ===
      // Important: Always unsubscribe when done
      unsubscribeState();
      unsubscribeView();

      // === Key Takeaways ===
      // 1. State access is through views - they return current values
      // 2. Actions are direct methods on the adapter
      // 3. Views are functions that return UI attributes or data
      // 4. For reactivity, use subscribe with view selectors
      // 5. In React, hooks handle subscriptions automatically
      // 6. In vanilla JS, you manage the subscription lifecycle yourself
    });

    it('should show practical vanilla JS UI update pattern', () => {
      // This example shows a realistic pattern for updating UI in vanilla JS

      const counter = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
          decrement: m().decrement,
        }));

        // View for button attributes
        const buttonAttrs = createSlice(model, (m) => ({
          incrementDisabled: m().count >= 10,
          decrementDisabled: m().count <= -10,
          countText: `Count: ${m().count}`,
          className:
            m().count === 0 ? 'zero' : m().count > 0 ? 'positive' : 'negative',
        }));

        return { model, actions, views: { buttonAttrs } };
      };

      const store = createZustandAdapter(counter);

      // Simulate a simple UI update function
      const renderedStates: Array<{
        countText: string;
        className: string;
        incrementDisabled: boolean;
        decrementDisabled: boolean;
      }> = [];
      const renderUI = () => {
        const attrs = store.views.buttonAttrs();

        renderedStates.push({
          ...attrs,
        });

        // In real app, you'd update DOM here:
        // document.querySelector('#count').textContent = attrs.countText;
        // document.querySelector('#increment').disabled = attrs.incrementDisabled;
        // etc.
      };

      // Initial render
      renderUI();
      expect(renderedStates[0]).toEqual({
        incrementDisabled: false,
        decrementDisabled: false,
        countText: 'Count: 0',
        className: 'zero',
      });

      // Set up subscription for reactive updates
      const unsubscribe = store.subscribe(
        (views) => views.buttonAttrs(),
        () => renderUI()
      );

      // Simulate button clicks
      store.actions.increment();
      expect(renderedStates[1]!.countText).toBe('Count: 1');
      expect(renderedStates[1]!.className).toBe('positive');

      store.actions.increment();
      store.actions.increment();
      expect(renderedStates[3]!.countText).toBe('Count: 3');

      // Test boundary
      for (let i = 0; i < 7; i++) store.actions.increment(); // Total: 10
      expect(renderedStates[10]!.countText).toBe('Count: 10');
      expect(renderedStates[10]!.incrementDisabled).toBe(true);
      expect(renderedStates[10]!.decrementDisabled).toBe(false);

      // Decrement
      store.actions.decrement();
      expect(renderedStates[11]!.countText).toBe('Count: 9');
      expect(renderedStates[11]!.incrementDisabled).toBe(false);

      // Cleanup
      unsubscribe();

      // After unsubscribe, changes don't trigger renders
      store.actions.increment();
      // Can verify through view that state updated
      const currentAttrs = store.views.buttonAttrs();
      expect(currentAttrs.countText).toBe('Count: 10');
      expect(renderedStates).toHaveLength(12); // But no new renders
    });

    it('should demonstrate view subscriptions separate from state subscriptions', () => {
      // This shows how views have their own subscription mechanism

      const app = () => {
        const model = createModel<{
          user: { name: string; role: string };
          theme: 'light' | 'dark';
          updateUser: (user: { name: string; role: string }) => void;
          toggleTheme: () => void;
        }>(({ set, get }) => ({
          user: { name: 'Alice', role: 'user' },
          theme: 'light',
          updateUser: (user) => set({ user }),
          toggleTheme: () =>
            set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
        }));

        const userView = createSlice(model, (m) => ({
          displayName: `${m().user.name} (${m().user.role})`,
          isAdmin: m().user.role === 'admin',
          themeClass: `theme-${m().theme}`,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateUser: m().updateUser,
            toggleTheme: m().toggleTheme,
          })),
          views: { user: userView },
        };
      };

      const store = createZustandAdapter(app);

      // Track what triggers updates
      let viewUpdateCount = 0;
      let userViewUpdateCount = 0;

      // Subscribe to any view change
      const unsubscribeGeneral = store.subscribe(
        (views) => views.user(),
        () => {
          viewUpdateCount++;
        }
      );

      // Subscribe to specific view
      const unsubscribeUserView = store.subscribe(
        (views) => views.user(),
        () => {
          userViewUpdateCount++;
        }
      );

      // Initial state
      expect(store.views.user()).toEqual({
        displayName: 'Alice (user)',
        isAdmin: false,
        themeClass: 'theme-light',
      });

      // Update theme - both subscriptions fire
      store.actions.toggleTheme();

      expect(viewUpdateCount).toBe(1);
      expect(userViewUpdateCount).toBe(1);
      expect(store.views.user().themeClass).toBe('theme-dark');

      // Update user - both fire again
      store.actions.updateUser({ name: 'Bob', role: 'admin' });

      expect(viewUpdateCount).toBe(2);
      expect(userViewUpdateCount).toBe(2);
      expect(store.views.user()).toEqual({
        displayName: 'Bob (admin)',
        isAdmin: true,
        themeClass: 'theme-dark',
      });

      // Views are computed from the adapter state
      // They update whenever the underlying state changes

      unsubscribeGeneral();
      unsubscribeUserView();
    });
  });

  describe('namespace collision avoidance', () => {
    it('should handle models with properties named store, actions, or views', () => {
      const component = () => {
        const model = createModel<{
          store: string;
          actions: number;
          views: boolean;
          data: { nested: string };
          update: (
            updates: Partial<{ store: string; actions: number; views: boolean }>
          ) => void;
        }>(({ set, get }) => ({
          store: 'model-store-value',
          actions: 42,
          views: true,
          data: { nested: 'value' },
          update: (updates) => set({ ...get(), ...updates }),
        }));

        const actions = createSlice(model, (m) => ({
          update: m().update,
        }));

        const stateSlice = createSlice(model, (m) => ({
          store: m().store,
          actions: m().actions,
          views: m().views,
          nested: m().data.nested,
        }));

        return { model, actions, views: { state: stateSlice } };
      };

      const store = createZustandAdapter(component);

      // Adapter properties should be of correct types
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.actions.update).toBe('function');
      expect(typeof store.views.state).toBe('function');

      // Should NOT expose internals
      // @ts-expect-error
      expect(store.setState).toBeUndefined();
      // @ts-expect-error
      expect(store.use).toBeUndefined();

      // Model state should be accessible through views
      const stateView = store.views.state();
      expect(stateView.store).toBe('model-store-value');
      expect(stateView.actions).toBe(42);
      expect(stateView.views).toBe(true);
      expect(stateView.nested).toBe('value');

      // Updates should work
      store.actions.update({ store: 'new-value', actions: 100 });

      // Verify updates through views
      const updatedView = store.views.state();
      expect(updatedView.store).toBe('new-value');
      expect(updatedView.actions).toBe(100);
      expect(updatedView.views).toBe(true); // Unchanged
      expect(updatedView.nested).toBe('value'); // Unchanged
    });
  });

  describe('lazy getters', () => {
    it('should resolve zero-argument functions as getters', () => {
      const component = () => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [
            { id: 1, text: 'First todo', done: false },
            { id: 2, text: 'Second todo', done: true },
            { id: 3, text: 'Third todo', done: false },
          ],
          filter: 'all',
          addTodo: (text) => set({ 
            todos: [...get().todos, { id: Date.now(), text, done: false }] 
          }),
          setFilter: (filter) => set({ filter }),
        }));

        // Slice with lazy getters
        const statsSlice = createSlice(model, (m) => ({
          // Static value
          filter: m().filter,
          // Lazy getters (zero-argument functions)
          total: () => m().todos.length,
          active: () => m().todos.filter(t => !t.done).length,
          completed: () => m().todos.filter(t => t.done).length,
          // Nested lazy getter
          summary: () => ({
            text: () => `${m().todos.filter(t => !t.done).length} of ${m().todos.length} remaining`,
            percentage: () => {
              const total = m().todos.length;
              const completed = m().todos.filter(t => t.done).length;
              return total > 0 ? Math.round((completed / total) * 100) : 0;
            }
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addTodo: m().addTodo,
            setFilter: m().setFilter,
          })),
          views: { stats: statsSlice },
        };
      };

      const store = createZustandAdapter(component);

      // Get initial stats
      const stats = store.views.stats();
      
      // Static value should be resolved directly
      expect(stats.filter).toBe('all');
      
      // Lazy getters should be resolved to their values
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.completed).toBe(1);
      
      // Nested lazy getters should also be resolved
      expect((stats.summary as any).text).toBe('2 of 3 remaining');
      expect((stats.summary as any).percentage).toBe(33);

      // Add a new todo and verify stats update
      store.actions.addTodo('Fourth todo');
      
      const newStats = store.views.stats();
      expect(newStats.total).toBe(4);
      expect(newStats.active).toBe(3);
      expect(newStats.completed).toBe(1);
      expect((newStats.summary as any).text).toBe('3 of 4 remaining');
      expect((newStats.summary as any).percentage).toBe(25);
    });

    it('should handle arrays with lazy getters', () => {
      const component = () => {
        const model = createModel<{
          items: string[];
        }>(() => ({
          items: ['a', 'b', 'c'],
        }));

        const viewSlice = createSlice(model, (m) => ({
          // Array of lazy getters
          itemGetters: [
            () => m().items[0],
            () => m().items[1], 
            () => m().items[2],
          ],
          // Lazy getter returning an array
          reversed: () => [...m().items].reverse(),
        }));

        return {
          model,
          actions: createSlice(model, (_m) => ({})),
          views: { items: viewSlice },
        };
      };

      const store = createZustandAdapter(component);
      const view = store.views.items();

      // Array of getters should be resolved
      expect(view.itemGetters).toEqual(['a', 'b', 'c']);
      
      // Getter returning array should be resolved
      expect(view.reversed).toEqual(['c', 'b', 'a']);
    });
  });
});

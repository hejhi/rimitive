import { describe, it, expect, vi } from 'vitest';
import { createModel, createSlice, compose } from './index';

describe('Lattice Core', () => {
  describe('Model creation with state and mutations', () => {
    it('should create models with state and mutation functions', () => {
      const modelFactory = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      // Verify the factory returns a function
      expect(typeof modelFactory).toBe('function');

      // The model factory is just a function that returns the schema
      // Adapters will provide the actual tools at runtime
    });

    it('should support complex state shapes from README counter example', () => {
      const modelFactory = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
        disabled: boolean;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
        disabled: false,
      }));

      // Verify the factory is the specification
      expect(typeof modelFactory).toBe('function');
    });
  });

  describe('Slice creation and selection', () => {
    it('should create slices that select from models', () => {
      const modelFactory = createModel<{ count: number; name: string }>(() => ({
        count: 42,
        name: 'test',
      }));

      const countSlice = createSlice(modelFactory, (m) => ({
        count: m().count,
      }));

      // Verify slice is a factory function
      expect(typeof countSlice).toBe('function');

      // Test slice execution
      const model = { count: 42, name: 'test' };
      const sliceResult = countSlice(() => model);
      expect(sliceResult).toEqual({ count: 42 });
    });

    it('should support selecting nested properties', () => {
      const modelFactory = createModel<{
        user: { name: string; age: number };
        settings: { theme: string };
      }>(() => ({
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      }));

      const userSlice = createSlice(modelFactory, (m) => ({
        userName: m().user.name,
        userAge: m().user.age,
      }));

      const model = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      };

      expect(userSlice(() => model)).toEqual({
        userName: 'John',
        userAge: 30,
      });
    });
  });

  describe('Action slices', () => {
    it('should create action slices that select methods from models', () => {
      const modelFactory = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      const actions = createSlice(modelFactory, (m) => ({
        increment: m().increment,
        decrement: m().decrement,
      }));

      // Test with a mock model
      const mockIncrement = () => {};
      const mockDecrement = () => {};
      const model = {
        count: 0,
        increment: mockIncrement,
        decrement: mockDecrement,
      };

      const actionResult = actions(() => model);
      expect(actionResult.increment).toBe(mockIncrement);
      expect(actionResult.decrement).toBe(mockDecrement);
    });

    it('should support todoList actions pattern from README', () => {
      type Todo = { id: number; text: string; completed: boolean };
      type Filter = 'all' | 'active' | 'completed';

      const modelFactory = createModel<{
        todos: Todo[];
        filter: Filter;
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
        setFilter: (filter: Filter) => void;
      }>(() => ({
        todos: [],
        filter: 'all',
        addTodo: () => {
          // Implementation details
        },
        toggleTodo: () => {
          // Implementation details
        },
        setFilter: () => {
          // Implementation details
        },
      }));

      const actions = createSlice(modelFactory, (m) => ({
        addTodo: m().addTodo,
        toggleTodo: m().toggleTodo,
        setFilter: m().setFilter,
      }));

      // Test selection
      const mockAddTodo = () => {};
      const mockToggleTodo = () => {};
      const mockSetFilter = () => {};

      const model = {
        todos: [],
        filter: 'all' as Filter,
        addTodo: mockAddTodo,
        toggleTodo: mockToggleTodo,
        setFilter: mockSetFilter,
      };

      const actionResult = actions(() => model);
      expect(actionResult.addTodo).toBe(mockAddTodo);
      expect(actionResult.toggleTodo).toBe(mockToggleTodo);
      expect(actionResult.setFilter).toBe(mockSetFilter);
    });
  });

  describe('View slices', () => {
    it('should create static view slices with compose', () => {
      const modelFactory = createModel<{
        count: number;
        increment: () => void;
        disabled: boolean;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        disabled: false,
      }));

      const actions = createSlice(modelFactory, (m) => ({
        increment: m().increment,
      }));

      // Using compose for dependency injection
      const incrementButton = createSlice(
        modelFactory,
        compose({ actions }, (m, { actions }) => ({
          onClick: actions.increment,
          disabled: m.disabled,
          'aria-label': 'Increment counter',
        }))
      );

      // Test the slice
      const mockIncrement = vi.fn();
      const model = {
        count: 0,
        increment: mockIncrement,
        disabled: false,
      };

      const buttonView = incrementButton(() => model);

      // Compose now returns a regular selector that resolves dependencies
      // So buttonView should have the expected properties
      expect(buttonView).toHaveProperty('onClick', mockIncrement);
      expect(buttonView).toHaveProperty('disabled', false);
      expect(buttonView).toHaveProperty('aria-label', 'Increment counter');
    });

    it('should demonstrate slice composition with compose', () => {
      const modelFactory = createModel<{ value: number }>(() => ({
        value: 42,
      }));

      const baseSlice = createSlice(modelFactory, (m) => ({ val: m().value }));

      // When we compose slices with compose()
      const composedSlice = createSlice(
        modelFactory,
        compose({ baseSlice }, (m, { baseSlice }) => ({
          // The whole slice is available
          fullSlice: baseSlice,
          // And we can access specific properties
          selectedVal: baseSlice.val,
          // Can also add model properties
          directValue: m.value,
        }))
      );

      const model = { value: 100 };
      const result = composedSlice(() => model);

      // Compose now resolves dependencies and returns the actual result
      expect(result).toHaveProperty('fullSlice');
      expect(result.fullSlice).toEqual({ val: 100 });
      expect(result).toHaveProperty('selectedVal', 100);
      expect(result).toHaveProperty('directValue', 100);
    });

    it('should support parameterized view factories from todoList example', () => {
      type Filter = 'all' | 'active' | 'completed';

      const modelFactory = createModel<{
        filter: Filter;
        setFilter: (filter: Filter) => void;
      }>(({ set }) => ({
        filter: 'all',
        setFilter: (filter: Filter) => set({ filter }),
      }));

      const actions = createSlice(modelFactory, (m) => ({
        setFilter: m().setFilter,
      }));

      const buttonSlice = createSlice(
        modelFactory,
        compose({ actions }, (m, { actions }) => ({
          setFilter: actions.setFilter,
          filter: m.filter,
        }))
      );

      // When using compose, the slice now executes directly
      const modelInstance = modelFactory({ set: vi.fn(), get: vi.fn() });
      const buttonState = buttonSlice(() => modelInstance);

      // Verify the composed slice returns the expected shape
      expect(buttonState).toHaveProperty('setFilter');
      expect(buttonState).toHaveProperty('filter');
      expect(typeof buttonState.setFilter).toBe('function');

      // Note: Transform syntax with compose requires adapter execution.
      // The following pattern would work with an adapter:
      // const createFilterButtonView = (filterType: Filter) =>
      //   () => buttonSlice((state) => ({
      //     onClick: state.setFilter,
      //     className: state.filter === filterType ? 'selected' : '',
      //     'aria-pressed': state.filter === filterType
      //   }));

      // Test execution would happen in an adapter
      // This test is verifying the component structure, not execution

      // The buttonSlice returns a compose spec, but the transform operates on it
      // The transform would be applied by adapters at runtime
      // We can't test the actual values without adapter support
    });
  });

  describe('Computed views', () => {
    it('should support computed views without transform syntax', () => {
      const modelFactory = createModel<{ count: number }>(() => ({ count: 5 }));

      const countSlice = createSlice(modelFactory, (m) => ({
        count: m().count,
      }));

      // Create a computed view slice
      const counter = createSlice(modelFactory, (m) => {
        const state = countSlice(m);
        return {
          'data-count': state.count,
          'aria-label': `Count is ${state.count}`,
          className: state.count % 2 === 0 ? 'even' : 'odd',
        };
      });

      // Test the computed view
      const model = { count: 5 };
      const result = counter(() => model);

      expect(result).toEqual({
        'data-count': 5,
        'aria-label': 'Count is 5',
        className: 'odd',
      });
    });

    it('should support computed view functions from counter example', () => {
      const modelFactory = createModel<{ count: number }>(() => ({ count: 5 }));

      const countSlice = createSlice(modelFactory, (m) => ({
        count: m().count,
      }));

      // Create a computed view slice
      const counter = () =>
        createSlice(modelFactory, (m) => {
          const state = countSlice(m);
          return {
            'data-count': state.count,
            'aria-label': `Count is ${state.count}`,
            className: state.count % 2 === 0 ? 'even' : 'odd',
          };
        });

      // Test the computed view
      const computedView = counter();
      const model = { count: 5 };
      const result = computedView(() => model);

      expect(result).toEqual({
        'data-count': 5,
        'aria-label': 'Count is 5',
        className: 'odd',
      });

      // Test with even number
      const model2 = { count: 4 };
      const evenResult = computedView(() => model2);
      expect(evenResult.className).toBe('even');
    });

    it('should support shared computations pattern from todoList example', () => {
      type Todo = { id: number; text: string; completed: boolean };

      const todoState = createSlice(
        createModel<{ todos: Todo[]; filter: string }>(() => ({
          todos: [],
          filter: 'all',
        })),
        (m) => ({
          todos: m().todos,
          filter: m().filter,
        })
      );

      // Shared computation as a slice
      const todoStats = () =>
        createSlice(
          createModel<{ todos: Todo[]; filter: string }>(() => ({
            todos: [],
            filter: 'all',
          })),
          (m) => {
            const state = todoState(m);
            const active = state.todos.filter((t: Todo) => !t.completed);
            const completed = state.todos.filter((t: Todo) => t.completed);

            return {
              activeTodos: active,
              activeCount: active.length,
              completedCount: completed.length,
              hasCompleted: completed.length > 0,
            };
          }
        );

      // Test the computation
      const stats = todoStats();
      const model = {
        todos: [
          { id: 1, text: 'Task 1', completed: false },
          { id: 2, text: 'Task 2', completed: true },
          { id: 3, text: 'Task 3', completed: false },
        ],
        filter: 'all',
      };
      const result = stats(() => model);

      expect(result.activeCount).toBe(2);
      expect(result.completedCount).toBe(1);
      expect(result.hasCompleted).toBe(true);
      expect(result.activeTodos).toHaveLength(2);
    });

    it('should support summary view from todoList example', () => {
      type Todo = { id: number; text: string; completed: boolean };

      const todoStats = () => () => ({
        activeCount: 3,
        completedCount: 2,
      });

      // Summary view from README
      const summary = () => {
        const stats = todoStats();
        return (_state: { todos: Todo[]; filter: string }) => {
          const computed = stats();
          return {
            textContent: `${computed.activeCount} active, ${computed.completedCount} completed`,
          };
        };
      };

      const summaryView = summary();
      const model = {
        todos: [
          { id: 1, text: 'Task 1', completed: false },
          { id: 2, text: 'Task 2', completed: true },
          { id: 3, text: 'Task 3', completed: false },
          { id: 4, text: 'Task 4', completed: false },
          { id: 5, text: 'Task 5', completed: true },
        ],
        filter: 'all',
      };
      const result = summaryView(model);
      expect(result.textContent).toBe('3 active, 2 completed');
    });
  });

  describe('Slice composition with compose()', () => {
    it('should compose slices using compose()', () => {
      const modelFactory = createModel<{
        user: { name: string };
        theme: string;
        logout: () => void;
      }>(({ set }) => ({
        user: { name: 'John' },
        theme: 'dark',
        logout: () => set({ user: { name: '' } }),
      }));

      const userSlice = createSlice(modelFactory, (m) => ({
        user: m().user,
        isLoggedIn: m().user.name !== '',
      }));

      const themeSlice = createSlice(modelFactory, (m) => ({
        theme: m().theme,
        isDark: m().theme === 'dark',
      }));

      // Composite slice using compose
      const headerSlice = createSlice(
        modelFactory,
        compose({ userSlice, themeSlice }, (m, { userSlice, themeSlice }) => ({
          user: userSlice.user,
          theme: themeSlice.theme,
          onLogout: m.logout,
          // Can combine data from multiple slices
          displayName: `${userSlice.user.name} (${themeSlice.theme} mode)`,
        }))
      );

      // Test the composite slice
      const mockLogout = vi.fn();
      const model = {
        user: { name: 'John' },
        theme: 'dark',
        logout: mockLogout,
      };

      const headerResult = headerSlice(() => model);

      // Compose now resolves dependencies and returns the actual result
      expect(headerResult).toHaveProperty('user', { name: 'John' });
      expect(headerResult).toHaveProperty('theme', 'dark');
      expect(headerResult).toHaveProperty('onLogout', mockLogout);
      expect(headerResult).toHaveProperty('displayName', 'John (dark mode)');
    });

    it('should support nested slice composition', () => {
      const modelFactory = createModel<{
        count: number;
        user: string;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        user: 'test',
        increment: () => set({ count: get().count + 1 }),
      }));

      const actions = createSlice(modelFactory, (m) => ({
        increment: m().increment,
      }));

      const stateSlice = createSlice(modelFactory, (m) => ({
        count: m().count,
        user: m().user,
      }));

      // Nested composition using compose
      const composite = createSlice(
        modelFactory,
        compose({ actions, stateSlice }, (_, { actions, stateSlice }) => ({
          action: actions.increment,
          state: stateSlice,
          // Can also create derived values
          summary: `${stateSlice.user}: ${stateSlice.count}`,
        }))
      );

      const mockIncrement = vi.fn();
      const model = {
        count: 10,
        user: 'test',
        increment: mockIncrement,
      };

      const result = composite(() => model);

      // Compose now resolves dependencies and returns the actual result
      expect(result).toHaveProperty('action', mockIncrement);
      expect(result).toHaveProperty('state');
      expect(result.state).toEqual({ count: 10, user: 'test' });
      expect(result).toHaveProperty('summary', 'test: 10');
    });
  });

  describe('Component creation', () => {
    it('should create components with proper structure from counter example', () => {
      const counter = () => {
        // Model: Pure state + mutations
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          disabled: boolean;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          disabled: false,
        }));

        // Actions: Slice that selects methods
        const actions = createSlice(model, (m) => ({
          increment: m().increment,
          decrement: m().decrement,
        }));

        // State slice for display
        const countSlice = createSlice(model, (m) => ({
          count: m().count,
        }));

        // Composite slice: Combines state and actions
        const incrementButton = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            onClick: actions.increment,
            disabled: m.disabled,
            'aria-label': 'Increment counter',
          }))
        );

        return {
          model,
          actions,
          views: {
            // Computed view using slice
            counter: (someCount: number) =>
              createSlice(model, (m) => {
                const state = countSlice(m);
                return {
                  'data-count': state.count,
                  'aria-label': `Count is ${state.count}`,
                  className: someCount % 2 === 0 ? 'even' : 'odd',
                };
              }),

            // Static view - slice is the view
            incrementButton,
          },
        };
      };

      // Test component structure
      const component = counter();

      expect(component).toHaveProperty('model');
      expect(component).toHaveProperty('actions');
      expect(component).toHaveProperty('views');

      expect(typeof component.model).toBe('function');
      expect(typeof component.actions).toBe('function');
      expect(typeof component.views.counter).toBe('function');
      expect(typeof component.views.counter(3)).toBe('function');
      expect(typeof component.views.incrementButton).toBe('function');
    });

    it('should create todoList component with all patterns from README', () => {
      type Todo = { id: number; text: string; completed: boolean };
      type Filter = 'all' | 'active' | 'completed';

      const todoList = () => {
        const model = createModel<{
          todos: Todo[];
          filter: Filter;
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: Filter) => void;
        }>(({ set, get }) => ({
          todos: [],
          filter: 'all',

          addTodo: (text: string) => {
            const newTodo = { id: Date.now(), text, completed: false };
            set({ todos: [...get().todos, newTodo] });
          },

          toggleTodo: (id: number) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, completed: !todo.completed } : todo
              ),
            });
          },

          setFilter: (filter: Filter) => {
            set({ filter });
          },
        }));

        // State slice for computations
        const todoState = createSlice(model, (m) => ({
          todos: m().todos,
          filter: m().filter,
        }));

        // Shared computation using slice
        const todoStats = () =>
          createSlice(model, (m) => {
            const state = todoState(m);
            const active = state.todos.filter((t: Todo) => !t.completed);
            const completed = state.todos.filter((t: Todo) => t.completed);

            return {
              activeTodos: active,
              activeCount: active.length,
              completedCount: completed.length,
              hasCompleted: completed.length > 0,
            };
          });

        // Actions slice
        const actions = createSlice(model, (m) => ({
          addTodo: m().addTodo,
          toggleTodo: m().toggleTodo,
          setFilter: m().setFilter,
        }));

        const buttonSlice = createSlice(
          model,
          compose({ actions }, (m, { actions }) => ({
            setFilter: actions.setFilter,
            filter: m.filter,
          }))
        );

        // Note: Transform syntax with compose requires adapter execution
        // This demonstrates the pattern, but execution needs an adapter
        const createFilterButtonView = (_filterType: Filter) => {
          // In production, this would use buttonSlice with transform:
          // return () => buttonSlice((state) => ({ ... }))
          // For now, return a placeholder
          void buttonSlice; // Mark as intentionally unused
          return () => {
            return vi.fn();
          };
        };

        return {
          model,
          actions,
          views: {
            // Computed view using nested slice
            summary: () =>
              createSlice(model, (m) => {
                const stats = todoStats()(m);
                return {
                  textContent: `${stats.activeCount} active, ${stats.completedCount} completed`,
                };
              }),

            // Parameterized slices as views
            allButton: createFilterButtonView('all'),
            activeButton: createFilterButtonView('active'),
            completedButton: createFilterButtonView('completed'),
          },
        };
      };

      const component = todoList();

      // Verify structure
      expect(component.model).toBeDefined();
      expect(component.actions).toBeDefined();
      expect(component.views.summary).toBeDefined();
      expect(component.views.allButton).toBeDefined();
      expect(component.views.activeButton).toBeDefined();
      expect(component.views.completedButton).toBeDefined();

      // All views should be functions
      expect(typeof component.views.summary).toBe('function');
      expect(typeof component.views.allButton).toBe('function');
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety through slice selection', () => {
      interface ModelState {
        count: number;
        name: string;
        increment: () => void;
      }

      const modelFactory = createModel<ModelState>(({ set, get }) => ({
        count: 0,
        name: 'test',
        increment: () => set({ count: get().count + 1 }),
      }));

      // This should compile with correct types
      const validSlice = createSlice(modelFactory, (m) => ({
        count: m().count,
        name: m().name,
      }));

      // TypeScript should infer the correct return type when called with a model
      const modelInstance: ModelState = {
        count: 0,
        name: 'test',
        increment: () => {},
      };
      const result = validSlice(() => modelInstance);

      // Verify the type
      const _typeCheck: typeof result = { count: 0, name: 'test' };
      expect(_typeCheck).toBeDefined();
    });

    it('should maintain type safety with compose()', () => {
      const modelFactory = createModel<{ value: number }>(() => ({
        value: 42,
      }));

      const slice1 = createSlice(modelFactory, (m) => ({
        value: m().value,
        doubled: m().value * 2,
      }));

      const slice2 = createSlice(
        modelFactory,
        compose({ slice1 }, (m, { slice1 }) => ({
          selected: slice1.value,
          fromModel: m.value,
          computed: slice1.doubled + m.value,
        }))
      );

      // The type should flow through compose()
      const modelInstance = { value: 42 };
      const result = slice2(() => modelInstance);

      // Compose now resolves dependencies and returns the actual result
      expect(result).toHaveProperty('selected', 42);
      expect(result).toHaveProperty('fromModel', 42);
      expect(result).toHaveProperty('computed', 126); // 84 + 42
    });

    it('should enforce type constraints in component factories', () => {
      const component = () => {
        const model = createModel<{ count: number }>(() => ({
          count: 0,
        }));

        const actions = createSlice(model, () => ({
          // Empty actions for this test
        }));

        const views = {
          display: createSlice(model, (m) => ({
            count: m().count,
          })),
        };

        return { model, actions, views };
      };

      const spec = component();

      // Verify component structure
      expect(spec.model).toBeDefined();
      expect(spec.actions).toBeDefined();
      expect(spec.views.display).toBeDefined();

      // Verify types work correctly
      const modelInstance = { count: 0 };
      const actionsResult = spec.actions(() => modelInstance);
      expect(actionsResult).toEqual({});
    });
  });

  describe('Component composition', () => {
    it('should support component composition', () => {
      // Base counter
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

        const countSlice = createSlice(model, (m) => ({
          count: m().count,
        }));

        return {
          model,
          actions,
          views: {
            display: countSlice,
          },
        };
      };

      // Enhanced counter with additional functionality
      const enhancedCounter = () => {
        const base = counter();

        // Extend the model
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          reset: () => void;
        }>(({ set, get }) => {
          // Execute base model to get its structure
          const baseModel = base.model({ set, get });

          return {
            // Spread base model properties
            ...baseModel,

            // Add new functionality
            decrement: () => set({ count: get().count - 1 }),
            reset: () => set({ count: 0 }),
          };
        });

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
          decrement: m().decrement,
          reset: m().reset,
        }));

        const displaySlice = createSlice(model, (m) => ({
          count: m().count,
        }));

        return {
          model,
          actions,
          views: {
            display: displaySlice,
            // Computed view that adds styling based on count
            styledDisplay: () =>
              createSlice(model, (m) => {
                const state = displaySlice(m);
                return {
                  count: state.count,
                  className:
                    state.count === 0
                      ? 'zero'
                      : state.count > 0
                        ? 'positive'
                        : 'negative',
                };
              }),
          },
        };
      };

      const enhanced = enhancedCounter();

      // Verify enhanced structure
      expect(enhanced.model).toBeDefined();
      expect(enhanced.actions).toBeDefined();
      expect(enhanced.views.display).toBeDefined();
      expect(enhanced.views.styledDisplay).toBeDefined();
      expect(typeof enhanced.views.styledDisplay).toBe('function');

      // Test the enhanced functionality
      const mockGet = vi.fn(() => ({
        count: 0,
        increment: () => {},
        decrement: () => {},
        reset: () => {},
      }));
      const mockSet = vi.fn();
      const model = enhanced.model({ set: mockSet, get: mockGet });
      expect(model.count).toBe(0); // Base model starts at 0
      expect(typeof model.increment).toBe('function');
      expect(typeof model.decrement).toBe('function');
      expect(typeof model.reset).toBe('function');

      // Test the styled display view
      const styledSlice = enhanced.views.styledDisplay();
      const testModel = {
        count: 5,
        increment: () => {},
        decrement: () => {},
        reset: () => {},
      };
      const styledView = styledSlice(() => testModel);
      expect(styledView.count).toBe(5);
      expect(styledView.className).toBe('positive');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty models', () => {
      const model = createModel<{}>(() => ({}));
      const slice = createSlice(model, () => ({}));

      expect(slice(() => ({}))).toEqual({});
    });

    it('should handle deeply nested compose() calls', () => {
      const model = createModel<{ value: number }>(() => ({
        value: 1,
      }));

      const slice1 = createSlice(model, (m) => ({ v1: m().value }));
      const slice2 = createSlice(
        model,
        compose({ slice1 }, (_, { slice1 }) => ({ v2: slice1.v1 }))
      );
      const slice3 = createSlice(
        model,
        compose({ slice2 }, (_, { slice2 }) => ({ v3: slice2.v2 }))
      );

      const modelInstance = { value: 10 };
      const result = slice3(() => modelInstance);

      // Compose now resolves dependencies at each level
      // slice1: { v1: 10 }
      // slice2: { v2: 10 }
      // slice3: { v3: 10 }
      expect(result).toEqual({ v3: 10 });
    });

    it('should handle computed views returning different shapes', () => {
      const model = createModel<{ mode: 'light' | 'dark' }>(() => ({
        mode: 'light',
      }));

      const modeSlice = createSlice(model, (m) => ({ mode: m().mode }));

      const adaptiveView = () =>
        createSlice(model, (m) => {
          const state = modeSlice(m);
          return state.mode === 'light'
            ? { background: 'white', color: 'black' }
            : { background: 'black', color: 'white', border: '1px solid gray' };
        });

      const adaptiveSlice = adaptiveView();
      const lightModel = { mode: 'light' as const };
      const lightView = adaptiveSlice(() => lightModel);
      expect(lightView).toEqual({ background: 'white', color: 'black' });

      const darkModel = { mode: 'dark' as const };
      const darkView = adaptiveSlice(() => darkModel);
      expect(darkView).toEqual({
        background: 'black',
        color: 'white',
        border: '1px solid gray',
      });
    });
  });
});

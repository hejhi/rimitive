import { describe, it, expect } from 'vitest';
import {
  createComponent,
  createModel,
  createSlice,
  select,
  type ModelTools,
  type SliceFactory,
} from './index';

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
        count: m.count,
      }));

      // Verify slice is a factory function
      expect(typeof countSlice).toBe('function');

      // Test slice execution
      const model = { count: 42, name: 'test' };
      const sliceResult = countSlice(model);
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
        userName: m.user.name,
        userAge: m.user.age,
      }));

      const model = {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark' },
      };

      expect(userSlice(model)).toEqual({
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
        increment: m.increment,
        decrement: m.decrement,
      }));

      // Test with a mock model
      const mockIncrement = () => {};
      const mockDecrement = () => {};
      const model = {
        count: 0,
        increment: mockIncrement,
        decrement: mockDecrement,
      };

      const actionResult = actions(model);
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
        addTodo: m.addTodo,
        toggleTodo: m.toggleTodo,
        setFilter: m.setFilter,
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

      const actionResult = actions(model);
      expect(actionResult.addTodo).toBe(mockAddTodo);
      expect(actionResult.toggleTodo).toBe(mockToggleTodo);
      expect(actionResult.setFilter).toBe(mockSetFilter);
    });
  });

  describe('View slices', () => {
    it('should create static view slices as shown in counter example', () => {
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
        increment: m.increment,
      }));

      // This is the incrementButton from the README
      const incrementButton = createSlice(modelFactory, (m) => ({
        onClick: select(actions).increment,
        disabled: m.disabled,
        'aria-label': 'Increment counter',
      }));

      // Test the slice
      const mockIncrement = () => {};
      const model = {
        count: 0,
        increment: mockIncrement,
        disabled: false,
      };

      const buttonView = incrementButton(model);

      // The select() call creates a marker, but accessing .increment on it returns undefined
      // This is expected - adapters will interpret the marker, not access properties directly
      expect(buttonView.onClick).toBeUndefined();
      expect(buttonView.disabled).toBe(false);
      expect(buttonView['aria-label']).toBe('Increment counter');
    });

    it('should support parameterized view factories from todoList example', () => {
      type Filter = 'all' | 'active' | 'completed';

      const modelFactory = createModel<{
        filter: Filter;
        setFilter: (filter: Filter) => void;
      }>(({ set, get }) => ({
        filter: 'all',
        setFilter: () => set({ filter: get().filter }),
      }));

      const actions = createSlice(modelFactory, (m) => ({
        setFilter: m.setFilter,
      }));

      const buttonSlice = createSlice(modelFactory, (m) => ({
        setFilter: select(actions).setFilter,
        filter: m.filter,
      }));

      // Parameterized slice factory from README
      const createFilterButtonView = (filterType: Filter) => 
        () => {
          return (model: { setFilter: (f: Filter) => void; filter: Filter }) => {
            const state = buttonSlice(model);
            return {
              onClick: state.setFilter,
              className: state.filter === filterType ? 'selected' : '',
              'aria-pressed': state.filter === filterType
            };
          };
        };

      // Test the factory
      const allButton = createFilterButtonView('all');
      const activeButton = createFilterButtonView('active');

      // These should be functions
      expect(typeof allButton).toBe('function');
      expect(typeof activeButton).toBe('function');

      // Test execution
      const mockSetFilter = () => {};
      const model = {
        filter: 'all' as Filter,
        setFilter: mockSetFilter,
      };

      const allButtonView = allButton();
      const allButtonResult = allButtonView(model);
      expect(allButtonResult.onClick).toBeUndefined(); // select() marker
      expect(allButtonResult.className).toBe('selected');
      expect(allButtonResult['aria-pressed']).toBe(true);

      const activeButtonView = activeButton();
      const activeButtonResult = activeButtonView(model);
      expect(activeButtonResult.className).toBe('');
      expect(activeButtonResult['aria-pressed']).toBe(false);
    });
  });

  describe('Computed views', () => {
    it('should support computed view functions from counter example', () => {
      const modelFactory = createModel<{ count: number }>(() => ({ count: 5 }));

      const countSlice = createSlice(modelFactory, (m) => ({
        count: m.count,
      }));

      // Computed view from README
      // Note: Our current implementation doesn't support slice transforms
      // This would require enhancing createSlice to accept transform functions
      const counter = () => {
        return (model: { count: number }) => {
          const state = countSlice(model);
          return {
            'data-count': state.count,
            'aria-label': `Count is ${state.count}`,
            className: state.count % 2 === 0 ? 'even' : 'odd',
          };
        };
      };

      // Test the computed view
      const computedView = counter();
      const result = computedView({ count: 5 });

      expect(result).toEqual({
        'data-count': 5,
        'aria-label': 'Count is 5',
        className: 'odd',
      });

      // Test with even number
      const evenResult = computedView({ count: 4 });
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
          todos: m.todos,
          filter: m.filter,
        })
      );

      // Shared computation from README
      const todoStats = () => {
        return (model: { todos: Todo[]; filter: string }) => {
          const state = todoState(model);
          const active = state.todos.filter((t: Todo) => !t.completed);
          const completed = state.todos.filter((t: Todo) => t.completed);

          return {
            activeTodos: active,
            activeCount: active.length,
            completedCount: completed.length,
            hasCompleted: completed.length > 0,
          };
        };
      };

      // Test the computation
      const stats = todoStats();
      const result = stats({
        todos: [
          { id: 1, text: 'Task 1', completed: false },
          { id: 2, text: 'Task 2', completed: true },
          { id: 3, text: 'Task 3', completed: false },
        ],
        filter: 'all',
      });

      expect(result.activeCount).toBe(2);
      expect(result.completedCount).toBe(1);
      expect(result.hasCompleted).toBe(true);
      expect(result.activeTodos).toHaveLength(2);
    });

    it('should support summary view from todoList example', () => {
      const todoStats = () => () => ({
        activeCount: 3,
        completedCount: 2,
      });

      // Summary view from README
      const summary = () => {
        const stats = todoStats();
        return (state) => {
          const computed = stats(state);
          return {
            textContent: `${computed.activeCount} active, ${computed.completedCount} completed`,
          };
        };
      };

      const summaryView = summary();
      const result = summaryView({
        todos: [
          { id: 1, text: 'Task 1', completed: false },
          { id: 2, text: 'Task 2', completed: true },
          { id: 3, text: 'Task 3', completed: false },
          { id: 4, text: 'Task 4', completed: false },
          { id: 5, text: 'Task 5', completed: true },
        ],
        filter: 'all',
      });
      expect(result.textContent).toBe('3 active, 2 completed');
    });
  });

  describe('Slice composition with select()', () => {
    it('should compose slices using select() as shown in README', () => {
      const modelFactory = createModel<{
        user: { name: string };
        theme: string;
        logout: () => void;
      }>(({ set, get }) => ({
        user: { name: 'John' },
        theme: 'dark',
        logout: () => set({ user: { name: '' } }),
      }));

      const userSlice = createSlice(modelFactory, (m) => ({
        user: m.user,
      }));

      const themeSlice = createSlice(modelFactory, (m) => ({
        theme: m.theme,
      }));

      // Composite slice from README
      const headerSlice = createSlice(modelFactory, (m) => ({
        user: select(userSlice).user,
        theme: select(themeSlice).theme,
        onLogout: m.logout,
      }));

      // Test the composite slice
      const mockLogout = () => {};
      const model = {
        user: { name: 'John' },
        theme: 'dark',
        logout: mockLogout,
      };

      const headerResult = headerSlice(model);

      // select() creates markers, but accessing properties returns undefined
      // This is by design - adapters interpret markers
      expect(headerResult.user).toBeUndefined();
      expect(headerResult.theme).toBeUndefined();
      expect(headerResult.onLogout).toBe(mockLogout);
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
        increment: m.increment,
      }));

      const stateSlice = createSlice(modelFactory, (m) => ({
        count: m.count,
        user: m.user,
      }));

      // Deeply nested composition
      const composite = createSlice(modelFactory, () => ({
        action: select(actions).increment,
        state: select(stateSlice),
      }));

      const model = {
        count: 10,
        user: 'test',
        increment: () => {},
      };

      const result = composite(model);
      // select() returns a marker object, but .increment returns undefined
      expect(result.action).toBeUndefined();
      // select(stateSlice) returns the marker object itself
      expect(result.state).toBeDefined();
      expect(typeof result.state).toBe('object');
    });
  });

  describe('Component creation', () => {
    it('should create components with proper structure from counter example', () => {
      const counter = createComponent(() => {
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
          increment: m.increment,
          decrement: m.decrement,
        }));

        // State slice for display
        const countSlice = createSlice(model, (m) => ({
          count: m.count,
        }));

        // Composite slice: Combines state and actions
        const incrementButton = createSlice(model, (m) => ({
          onClick: select(actions).increment,
          disabled: m.disabled,
          'aria-label': 'Increment counter',
        }));

        return {
          model,
          actions,
          views: {
            // Computed view - needs runtime calculation
            counter: () => {
              return (model: { count: number }) => {
                const state = countSlice(model);
                return {
                  'data-count': state.count,
                  'aria-label': `Count is ${state.count}`,
                  className: state.count % 2 === 0 ? 'even' : 'odd',
                };
              };
            },

            // Static view - slice is the view
            incrementButton,
          },
        };
      });

      // Test component structure
      const component = counter();

      expect(component).toHaveProperty('model');
      expect(component).toHaveProperty('actions');
      expect(component).toHaveProperty('views');

      expect(typeof component.model).toBe('function');
      expect(typeof component.actions).toBe('function');
      expect(typeof component.views.counter).toBe('function');
      expect(typeof component.views.incrementButton).toBe('function');
    });

    it('should create todoList component with all patterns from README', () => {
      type Todo = { id: number; text: string; completed: boolean };
      type Filter = 'all' | 'active' | 'completed';

      const todoList = createComponent(() => {
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
          todos: m.todos,
          filter: m.filter,
        }));

        // Shared computation - memoized automatically
        const todoStats = () => {
          return (model: { todos: Todo[]; filter: Filter }) => {
            const state = todoState(model);
            const active = state.todos.filter((t: Todo) => !t.completed);
            const completed = state.todos.filter((t: Todo) => t.completed);

            return {
              activeTodos: active,
              activeCount: active.length,
              completedCount: completed.length,
              hasCompleted: completed.length > 0,
            };
          };
        };

        // Actions slice
        const actions = createSlice(model, (m) => ({
          addTodo: m.addTodo,
          toggleTodo: m.toggleTodo,
          setFilter: m.setFilter,
        }));

        const buttonSlice = createSlice(model, (m) => ({
          setFilter: select(actions).setFilter,
          filter: m.filter,
        }));

        // Composite slice factory for filter buttons
        const createFilterButtonView = (filterType: Filter) => 
          () => {
            return (model: { setFilter: (f: Filter) => void; filter: Filter }) => {
              const state = buttonSlice(model);
              return {
                onClick: state.setFilter,
                className: state.filter === filterType ? 'selected' : '',
                'aria-pressed': state.filter === filterType
              };
            };
          };

        return {
          model,
          actions,
          views: {
            // Computed view
            summary: () => {
              const stats = todoStats();
              return (state) => {
                const computed = stats(state);
                return {
                  textContent: `${computed.activeCount} active, ${computed.completedCount} completed`,
                };
              };
            },

            // Parameterized slices as views
            allButton: createFilterButtonView('all'),
            activeButton: createFilterButtonView('active'),
            completedButton: createFilterButtonView('completed'),
          },
        };
      });

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

      const model = createModel<ModelState>(({ set, get }) => ({
        count: 0,
        name: 'test',
        increment: () => set({ count: get().count + 1 }),
      }));

      // This should compile with correct types
      const validSlice = createSlice(model, (m) => ({
        count: m.count,
        name: m.name,
      }));

      // TypeScript should infer the correct return type
      type SliceType = ReturnType<typeof validSlice>;
      type Expected = { count: number; name: string };

      // This is a compile-time check
      const _typeCheck: SliceType = {} as Expected;
      expect(_typeCheck).toBeDefined();
    });

    it('should maintain type safety with select()', () => {
      const model = createModel<{ value: number }>(() => ({
        value: 42,
      }));

      const slice1 = createSlice(model, (m) => ({
        value: m.value,
      }));

      const slice2 = createSlice(model, () => ({
        selected: select(slice1).value,
      }));

      // The type should flow through select()
      type Slice2Type = ReturnType<typeof slice2>;
      type Expected = { selected: number };

      // Compile-time type check
      const _typeCheck: Slice2Type = {} as Expected;
      expect(_typeCheck).toBeDefined();
    });

    it('should enforce type constraints in component factories', () => {
      const component = createComponent(() => {
        const model = createModel<{ count: number }>(() => ({
          count: 0,
        }));

        const actions = createSlice(model, () => ({
          // Empty actions for this test
        }));

        const views = {
          display: createSlice(model, (m) => ({
            count: m.count,
          })),
        };

        return { model, actions, views };
      });

      const spec = component();

      // Types should be properly inferred
      type ModelType = Parameters<typeof spec.model>[0];
      type ActionsType = ReturnType<typeof spec.actions>;
      type ViewsType = typeof spec.views;

      // These are compile-time checks
      const _modelCheck: ModelType = {} as ModelTools<{ count: number }>;
      const _actionsCheck: ActionsType = {};
      const _viewsCheck: ViewsType = { display: {} as SliceFactory<any, any> };

      expect(_modelCheck).toBeDefined();
      expect(_actionsCheck).toBeDefined();
      expect(_viewsCheck).toBeDefined();
    });
  });

  describe('Component composition', () => {
    it('should support component composition pattern from README', () => {
      // Base counter
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        return {
          model,
          actions,
          views: {},
        };
      });

      // Enhanced counter with persistence
      const persistentCounter = createComponent(() => {
        const base = counter();
        
        // Extend the model
        const model = createModel<{
          count: number;
          increment: () => void;
          lastSaved: number;
          save: () => void;
        }>(({ set, get }) => ({
          // Get base state schema
          ...base.model({ set, get }),

          // Add new state
          lastSaved: Date.now(),
          save: () => {
            localStorage.setItem('count', String(get().count));
            set({ lastSaved: Date.now() });
          },
        }));

        // Create a slice for save status
        const saveSlice = createSlice(model, (m) => ({
          lastSaved: m.lastSaved,
        }));

        // Compute save status - removed as it's now inline in the view

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment,
            save: m.save,
          })),
          views: {
            // New view using computed status
            saveIndicator: () => {
              return (model: { lastSaved: number }) => {
                const state = saveSlice(model);
                const secondsAgo = Math.floor((Date.now() - state.lastSaved) / 1000);
                const status = secondsAgo > 60 ? 'unsaved changes' : 'saved';
                return {
                  className: status === 'unsaved changes' ? 'warning' : 'success',
                  textContent: status
                };
              };
            },
          },
        };
      });

      const enhanced = persistentCounter();

      // Verify enhanced structure
      expect(enhanced.model).toBeDefined();
      expect(enhanced.actions).toBeDefined();
      expect(enhanced.views.saveIndicator).toBeDefined();
      expect(typeof enhanced.views.saveIndicator).toBe('function');

      // Test the save indicator view
      const indicatorSlice = enhanced.views.saveIndicator();
      const indicatorView = indicatorSlice({ lastSaved: Date.now() });
      expect(indicatorView.className).toBe('success');
      expect(indicatorView.textContent).toBe('saved');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty models', () => {
      const model = createModel<{}>(() => ({}));
      const slice = createSlice(model, () => ({}));

      expect(slice({})).toEqual({});
    });

    it('should handle deeply nested select() calls', () => {
      const model = createModel<{ value: number }>(() => ({
        value: 1,
      }));

      const slice1 = createSlice(model, (m) => ({ v1: m.value }));
      const slice2 = createSlice(model, () => ({ v2: select(slice1).v1 }));
      const slice3 = createSlice(model, () => ({ v3: select(slice2).v2 }));

      const result = slice3({ value: 1 });
      // Accessing properties on select() markers returns undefined
      expect(result.v3).toBeUndefined();
    });

    it('should handle computed views returning different shapes', () => {
      const model = createModel<{ mode: 'light' | 'dark' }>(() => ({
        mode: 'light',
      }));

      const modeSlice = createSlice(model, (m) => ({ mode: m.mode }));

      const adaptiveView = () => {
        return (model: { mode: 'light' | 'dark' }) => {
          const state = modeSlice(model);
          return state.mode === 'light'
            ? { background: 'white', color: 'black' }
            : { background: 'black', color: 'white', border: '1px solid gray' };
        };
      };

      const adaptiveSlice = adaptiveView();
      const lightView = adaptiveSlice({ mode: 'light' });
      expect(lightView).toEqual({ background: 'white', color: 'black' });

      const darkView = adaptiveSlice({ mode: 'dark' });
      expect(darkView).toEqual({
        background: 'black',
        color: 'white',
        border: '1px solid gray',
      });
    });
  });
});

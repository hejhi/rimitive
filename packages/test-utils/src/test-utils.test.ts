import { describe, it, expect } from 'vitest';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import {
  createComponentTest,
  testSlice,
  testModel,
  testView,
  createSnapshot,
  waitForState,
  TestStore,
} from './index.js';

describe('@lattice/test-utils', () => {
  describe('integration with real Lattice components', () => {
    it('should properly test a counter component', () => {
      const counter = createComponent(() => {
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

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count,
        }));

        const incrementButton = createSlice(model, (m) => ({
          onClick: m.increment, // Direct reference to model method
          disabled: m.disabled,
          'aria-label': 'Increment counter',
        }));

        // Create a computed view slice
        const counterViewSlice = createSlice(model, (m) => {
          const state = countSlice(m);
          return {
            'data-count': state.count,
            'aria-label': `Count is ${state.count}`,
            className: state.count % 2 === 0 ? 'even' : 'odd',
          };
        });

        return {
          model,
          actions,
          views: {
            counter: counterViewSlice,
            incrementButton,
          },
        };
      });

      const test = createComponentTest(counter);

      // Test initial state
      expect(test.getState().count).toBe(0);

      // Test computed view - it returns a function
      const counterView = test.getView('counter');
      expect(counterView).toEqual({
        'data-count': 0,
        'aria-label': 'Count is 0',
        className: 'even',
      });

      // Test static view
      const buttonView = test.getView('incrementButton');
      expect(buttonView.disabled).toBe(false);
      expect(buttonView['aria-label']).toBe('Increment counter');
      expect(typeof buttonView.onClick).toBe('function');

      // Execute the action from the button
      buttonView.onClick();

      // Verify state changed
      expect(test.getState().count).toBe(1);

      // Verify view updated
      const updatedView = test.getView('counter');
      expect(updatedView).toEqual({
        'data-count': 1,
        'aria-label': 'Count is 1',
        className: 'odd',
      });
    });

    it('should handle complex slice composition', () => {
      const app = createComponent(() => {
        const model = createModel<{
          user: { name: string; role: string };
          theme: string;
          logout: () => void;
        }>(({ set }) => ({
          user: { name: 'John', role: 'admin' },
          theme: 'light',
          logout: () => set({ user: { name: '', role: 'guest' } }),
        }));

        const userSlice = createSlice(model, (m) => ({
          user: m.user,
        }));

        const themeSlice = createSlice(model, (m) => ({
          theme: m.theme,
        }));

        // Create a slice that selects from other slices
        const headerSlice = createSlice(model, (m) => {
          // We need to execute the slices and combine their results
          const userData = userSlice(m);
          const themeData = themeSlice(m);

          return {
            user: userData.user,
            theme: themeData.theme,
            onLogout: m.logout,
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            logout: m.logout,
          })),
          views: {
            header: headerSlice,
          },
        };
      });

      const test = createComponentTest(app);
      const headerView = test.getView('header');

      expect(headerView.user).toEqual({ name: 'John', role: 'admin' });
      expect(headerView.theme).toBe('light');

      // Execute logout
      headerView.onLogout();

      // Verify state changed
      const updatedHeader = test.getView('header');
      expect(updatedHeader.user).toEqual({ name: '', role: 'guest' });
    });
  });

  describe('testSlice helper', () => {
    it('should test slices with compose()', () => {
      const model = createModel<{ user: { name: string }; status: string }>(
        () => ({
          user: { name: 'Test' },
          status: 'active',
        })
      );

      const userSlice = createSlice(model, (m) => ({ user: m.user }));

      // Create a slice that uses compose()
      const compositeSlice = createSlice(
        model,
        compose({ userSlice }, (m, { userSlice }) => ({
          userName: userSlice.user.name,
          isActive: m.status === 'active',
        }))
      );

      // Test with proper state structure
      const { getResult } = testSlice(
        {
          user: { name: 'Alice' },
          status: 'active',
        },
        compositeSlice
      );

      expect(getResult().userName).toBe('Alice');
      expect(getResult().isActive).toBe(true);
    });
  });

  describe('testModel helper', () => {
    it('should test models with complex mutations', () => {
      const todoModel = createModel<{
        todos: { id: number; text: string; done: boolean }[];
        addTodo: (text: string) => void;
        toggleTodo: (id: number) => void;
      }>(({ set, get }) => ({
        todos: [],
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
      }));

      const { model, store } = testModel(todoModel);

      expect(model.todos).toEqual([]);

      // Add a todo
      model.addTodo('Test todo');
      expect(store.getState().todos).toHaveLength(1);
      expect(store.getState().todos[0]?.text).toBe('Test todo');

      // Toggle it
      const todoId = store.getState().todos[0]?.id;
      todoId && model.toggleTodo(todoId);
      expect(store.getState().todos[0]?.done).toBe(true);
    });
  });

  describe('testView helper', () => {
    it('should test computed views with parameters', () => {
      const todoList = createComponent(() => {
        const model = createModel<{
          todos: { id: number; text: string; done: boolean }[];
          filter: 'all' | 'active' | 'completed';
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set }) => ({
          todos: [
            { id: 1, text: 'Task 1', done: false },
            { id: 2, text: 'Task 2', done: true },
          ],
          filter: 'all' as 'all' | 'active' | 'completed',
          setFilter: (filter: 'all' | 'active' | 'completed') => {
            set({ filter });
          },
        }));

        const todoState = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter,
        }));

        const actions = createSlice(model, (m) => ({
          setFilter: m.setFilter,
        }));

        // Create a computed view slice
        const filteredTodosSlice = createSlice(model, (m) => {
          const state = todoState(m);
          const filtered =
            state.filter === 'all'
              ? state.todos
              : state.filter === 'active'
                ? state.todos.filter((t) => !t.done)
                : state.todos.filter((t) => t.done);

          return {
            items: filtered,
            count: filtered.length,
            filter: state.filter,
          };
        });

        return {
          model,
          actions,
          views: {
            filteredTodos: filteredTodosSlice,
          },
        };
      });

      const { getViewOutput, executeAction } = testView(
        todoList,
        'filteredTodos'
      );

      // Test initial state
      let output = getViewOutput();
      expect(output.count).toBe(2);
      expect(output.filter).toBe('all');

      // Change filter
      executeAction('setFilter' as any, 'active');
      output = getViewOutput();
      expect(output.count).toBe(1);
      expect(output.items[0].text).toBe('Task 1');

      // Change to completed
      executeAction('setFilter' as any, 'completed');
      output = getViewOutput();
      expect(output.count).toBe(1);
      expect(output.items[0].text).toBe('Task 2');
    });
  });

  describe('snapshot testing', () => {
    it('should create consistent snapshots', () => {
      const data = {
        user: { id: 1, name: 'Test User' },
        settings: { theme: 'dark', notifications: true },
      };

      const snapshot = createSnapshot(data);

      expect(snapshot).toBe(`{
  "user": {
    "id": 1,
    "name": "Test User"
  },
  "settings": {
    "theme": "dark",
    "notifications": true
  }
}`);
    });
  });

  describe('waitForState', () => {
    it('should handle immediate state matches', async () => {
      const store = new TestStore({ ready: true });

      const state = await waitForState(store, (s) => s.ready === true);
      expect(state.ready).toBe(true);
    });

    it('should handle async state updates', async () => {
      const store = new TestStore({
        loading: true,
        data: null as string | null,
      });

      // Simulate async data loading
      setTimeout(() => {
        store.setState({ loading: false, data: 'loaded' });
      }, 100);

      const state = await waitForState(
        store,
        (s) => s.loading === false && s.data !== null
      );

      expect(state.loading).toBe(false);
      expect(state.data).toBe('loaded');
    });
  });

  describe('edge cases', () => {
    it('should handle components with no views', () => {
      const minimal = createComponent(() => {
        const model = createModel(() => ({ value: 42 }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {},
        };
      });

      const test = createComponentTest(minimal);
      expect(test.getState().value).toBe(42);
    });

    it('should handle slice composition with compose()', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { id: number; name: string; email: string };
          posts: { id: number; title: string; authorId: number }[];
        }>(() => ({
          user: { id: 1, name: 'Alice', email: 'alice@example.com' },
          posts: [
            { id: 1, title: 'First Post', authorId: 1 },
            { id: 2, title: 'Second Post', authorId: 1 },
          ],
        }));

        const userSlice = createSlice(model, (m) => m.user);
        const postsSlice = createSlice(model, (m) => m.posts);

        // Create a composite slice that uses compose()
        const profileSlice = createSlice(
          model,
          compose(
            { userSlice, postsSlice },
            (m, { userSlice, postsSlice }) => ({
              // Select only name from user slice
              userName: userSlice.name,
              // Select only post count from posts slice
              postCount: postsSlice.length,
              // Select full user object
              fullUser: userSlice,
            })
          )
        );

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            profile: profileSlice,
          },
        };
      });

      const test = createComponentTest(component);
      const profileView = test.getView('profile');

      // Verify composed values
      expect(profileView.userName).toBe('Alice');
      expect(profileView.postCount).toBe(2);

      // Verify full user object
      expect(profileView.fullUser).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
      });
    });

    it('should handle deeply nested slice composition', () => {
      const nested = createComponent(() => {
        const model = createModel<{ a: { b: { c: string } } }>(() => ({
          a: { b: { c: 'deep' } },
        }));

        const slice1 = createSlice(model, (m) => ({
          a: m.a,
        }));

        const slice2 = createSlice(model, (m) => {
          const s1 = slice1(m);
          return {
            b: s1.a.b,
          };
        });

        const slice3 = createSlice(model, (m) => {
          const s2 = slice2(m);
          return {
            c: s2.b.c,
          };
        });

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: {
            deep: slice3,
          },
        };
      });

      const test = createComponentTest(nested);
      expect(test.getView('deep')).toEqual({ c: 'deep' });
    });
  });
});

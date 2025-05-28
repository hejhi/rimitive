import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent, select } from '@lattice/core';

interface Store<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  subscribe: (listener: (value: T) => void) => () => void;
  destroy?: () => void;
}

describe('memory adapter - slice support', () => {
  describe('executeComponent', () => {
    it('should execute a component spec with model, actions, and views', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 })
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement
        }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count
        }));

        return {
          model,
          actions,
          views: {
            count: countSlice
          }
        };
      });

      const adapter = createMemoryAdapter();
      const { model, actions, views } = adapter.executeComponent(counter);

      // Test model store
      expect(model.get().count).toBe(0);
      
      // Test actions slice
      expect(typeof actions.get().increment).toBe('function');
      actions.get().increment();
      expect(model.get().count).toBe(1);

      // Test view slice
      const countView = views.count as Store<{ count: number }>;
      expect(countView.get()).toEqual({ count: 1 });
    });

    it('should handle computed views that return slices', () => {
      type Todo = { id: number; text: string; done: boolean };
      
      const todo = createComponent(() => {
        let nextId = 1;
        const model = createModel<{
          todos: Todo[];
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
        }>(({ set, get }) => ({
          todos: [],
          addTodo: (text: string) => set({
            todos: [...get().todos, { id: nextId++, text, done: false }]
          }),
          toggleTodo: (id: number) => set({
            todos: get().todos.map(t => 
              t.id === id ? { ...t, done: !t.done } : t
            )
          })
        }));

        const todoState = createSlice(model, (m) => ({
          todos: m.todos
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addTodo: m.addTodo,
            toggleTodo: m.toggleTodo
          })),
          views: {
            // Computed view function
            stats: () => todoState((state) => ({
              total: state.todos.length,
              completed: state.todos.filter(t => t.done).length
            }))
          }
        };
      });

      const adapter = createMemoryAdapter();
      const { model, actions, views } = adapter.executeComponent(todo);

      // Initial state
      const statsFactory = views.stats as () => Store<{ total: number; completed: number }>;
      const initialStats = statsFactory().get();
      expect(initialStats).toEqual({ total: 0, completed: 0 });

      // Add todos
      actions.get().addTodo('Test 1');
      actions.get().addTodo('Test 2');
      
      const afterAdd = statsFactory().get();
      expect(afterAdd).toEqual({ total: 2, completed: 0 });

      // Toggle one
      const firstTodo = model.get().todos[0];
      if (!firstTodo) throw new Error('No todos found');
      actions.get().toggleTodo(firstTodo.id);
      
      const afterToggle = statsFactory().get();
      expect(afterToggle).toEqual({ total: 2, completed: 1 });
    });

    it('should handle select() markers for slice composition', () => {
      const app = createComponent(() => {
        const model = createModel<{
          user: { name: string; role: string };
          theme: string;
          updateUserName: (name: string) => void;
          setTheme: (theme: string) => void;
        }>(({ set, get }) => ({
          user: { name: 'John', role: 'admin' },
          theme: 'dark',
          updateUserName: (name: string) => set({
            user: { ...get().user, name }
          }),
          setTheme: (theme: string) => set({ theme })
        }));

        const userSlice = createSlice(model, (m) => m.user);

        const themeSlice = createSlice(model, (m) => m.theme);

        // Composite slice using select()
        const headerSlice = createSlice(model, (m) => ({
          user: select(userSlice),
          theme: select(themeSlice),
          userName: m.user.name // Direct access too
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateUserName: m.updateUserName,
            setTheme: m.setTheme
          })),
          views: {
            header: headerSlice
          }
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(app);

      // Initial state
      const headerView = views.header as Store<any>;
      const header = headerView.get();
      expect(header.user).toEqual({ name: 'John', role: 'admin' });
      expect(header.theme).toBe('dark');
      expect(header.userName).toBe('John');

      // Update and verify composition works
      actions.get().updateUserName('Jane');
      const updated = headerView.get();
      expect(updated.user.name).toBe('Jane');
      expect(updated.userName).toBe('Jane');
    });

    it('should support slice subscriptions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment
          })),
          views: {
            count: createSlice(model, (m) => ({ value: m.count }))
          }
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(counter);

      const updates: Array<{ value: number }> = [];
      const countView = views.count as Store<{ value: number }>;
      const unsub = countView.subscribe((state) => {
        updates.push(state);
      });

      actions.get().increment();
      actions.get().increment();

      expect(updates).toEqual([
        { value: 1 },
        { value: 2 }
      ]);

      unsub();
      actions.get().increment();
      expect(updates.length).toBe(2); // No new updates
    });

    it('should handle transformed slices in views', () => {
      const app = createComponent(() => {
        const model = createModel<{
          x: number;
          y: number;
          setPosition: (x: number, y: number) => void;
        }>(({ set }) => ({
          x: 0,
          y: 0,
          setPosition: (x: number, y: number) => set({ x, y })
        }));

        const positionSlice = createSlice(model, (m) => ({
          x: m.x,
          y: m.y
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setPosition: m.setPosition
          })),
          views: {
            // Transformed slice
            distance: positionSlice((pos: { x: number; y: number }) => ({
              value: Math.sqrt(pos.x * pos.x + pos.y * pos.y)
            }))
          }
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(app);

      const distanceView = views.distance as Store<{ value: number }>;
      expect(distanceView.get()).toEqual({ value: 0 });

      actions.get().setPosition(3, 4);
      expect(distanceView.get()).toEqual({ value: 5 });
    });
  });

  describe('AdapterPrimitives', () => {
    it('should implement createStore primitive', () => {
      const adapter = createMemoryAdapter();
      const primitives = adapter.primitives;
      
      const store = primitives.createStore({ count: 0 });
      
      expect(store.get()).toEqual({ count: 0 });
      
      store.set({ count: 1 });
      expect(store.get()).toEqual({ count: 1 });
      
      store.set(prev => ({ count: prev.count + 1 }));
      expect(store.get()).toEqual({ count: 2 });
    });

    it('should implement createSlice primitive', () => {
      const adapter = createMemoryAdapter();
      const primitives = adapter.primitives;
      
      const store = primitives.createStore({ 
        user: { name: 'John', age: 30 },
        theme: 'dark' 
      });
      
      const userSlice = primitives.createSlice(store, state => state.user);
      
      expect(userSlice.get()).toEqual({ name: 'John', age: 30 });
      
      // Update parent store
      store.set(prev => ({
        ...prev,
        user: { ...prev.user, name: 'Jane' }
      }));
      
      expect(userSlice.get()).toEqual({ name: 'Jane', age: 30 });
    });

    it('should support slice subscriptions through primitives', () => {
      const adapter = createMemoryAdapter();
      const primitives = adapter.primitives;
      
      const store = primitives.createStore({ count: 0 });
      const slice = primitives.createSlice(store, state => ({ value: state.count }));
      
      const updates: Array<{ value: number }> = [];
      const unsub = slice.subscribe(val => updates.push(val));
      
      store.set({ count: 1 });
      store.set({ count: 2 });
      
      expect(updates).toEqual([
        { value: 1 },
        { value: 2 }
      ]);
      
      unsub();
      store.set({ count: 3 });
      expect(updates.length).toBe(2);
    });
  });
});
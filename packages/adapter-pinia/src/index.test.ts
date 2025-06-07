import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, computed, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createPiniaAdapter } from './index';
import { createModel, createSlice, compose } from '@lattice/core';

describe('Pinia Adapter', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  describe('createPiniaAdapter', () => {
    it('should create a reactive store', async () => {
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
          increment: m.increment,
          decrement: m.decrement,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
          doubled: createSlice(model, (m) => ({ value: m.count * 2 })),
        };

        return { model, actions, views };
      };

      const TestComponent = defineComponent({
        setup() {
          const store = createPiniaAdapter(counter);
          const count = computed(() => store.views.count().value);
          const doubled = computed(() => store.views.doubled().value);

          return { store, count, doubled };
        },
        template: `
          <div>
            <span class="count">{{ count }}</span>
            <span class="doubled">{{ doubled }}</span>
            <button @click="store.actions.increment">+</button>
            <button @click="store.actions.decrement">-</button>
          </div>
        `,
      });

      const wrapper = mount(TestComponent);

      expect(wrapper.find('.count').text()).toBe('0');
      expect(wrapper.find('.doubled').text()).toBe('0');

      const buttons = wrapper.findAll('button');
      await buttons[0]!.trigger('click');
      await nextTick();

      expect(wrapper.find('.count').text()).toBe('1');
      expect(wrapper.find('.doubled').text()).toBe('2');

      await buttons[1]!.trigger('click');
      await nextTick();

      expect(wrapper.find('.count').text()).toBe('0');
      expect(wrapper.find('.doubled').text()).toBe('0');
    });

    it('should handle complex state with arrays', async () => {
      const todoApp = () => {
        let nextId = 1;
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          removeTodo: (id: number) => void;
        }>(({ set, get }) => ({
          todos: [],
          addTodo: (text) => {
            const newTodo = { id: nextId++, text, done: false };
            set({ todos: [...get().todos, newTodo] });
          },
          toggleTodo: (id) => {
            set({
              todos: get().todos.map((todo) =>
                todo.id === id ? { ...todo, done: !todo.done } : todo
              ),
            });
          },
          removeTodo: (id) => {
            set({ todos: get().todos.filter((todo) => todo.id !== id) });
          },
        }));

        const actions = createSlice(model, (m) => ({
          addTodo: m.addTodo,
          toggleTodo: m.toggleTodo,
          removeTodo: m.removeTodo,
        }));

        const views = {
          todos: createSlice(model, (m) => m.todos),
          activeTodos: createSlice(model, (m) =>
            m.todos.filter((t) => !t.done)
          ),
          completedTodos: createSlice(model, (m) =>
            m.todos.filter((t) => t.done)
          ),
          stats: createSlice(model, (m) => ({
            total: m.todos.length,
            active: m.todos.filter((t) => !t.done).length,
            completed: m.todos.filter((t) => t.done).length,
          })),
        };

        return { model, actions, views };
      };

      const TestComponent = defineComponent({
        setup() {
          const store = createPiniaAdapter(todoApp);
          const todos = computed(() => store.views.todos());
          const stats = computed(() => store.views.stats());

          return { store, todos, stats };
        },
        template: `
          <div>
            <div class="stats">
              Total: {{ stats.total }}, 
              Active: {{ stats.active }}, 
              Completed: {{ stats.completed }}
            </div>
            <ul>
              <li v-for="todo in todos" :key="todo.id">
                <span :class="{ done: todo.done }">{{ todo.text }}</span>
              </li>
            </ul>
          </div>
        `,
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      expect(wrapper.find('.stats').text()).toContain('Total: 0');

      // Add todos
      store.actions.addTodo('First todo');
      store.actions.addTodo('Second todo');
      await nextTick();

      expect(wrapper.find('.stats').text()).toContain('Total: 2');
      expect(wrapper.find('.stats').text()).toContain('Active: 2');
      expect(wrapper.findAll('li')).toHaveLength(2);

      // Toggle first todo
      const firstTodo = store.views.todos()[0];
      if (firstTodo) {
        store.actions.toggleTodo(firstTodo.id);
        await nextTick();

        expect(wrapper.find('.stats').text()).toContain('Active: 1');
        expect(wrapper.find('.stats').text()).toContain('Completed: 1');
      }
    });

    it('should handle compose() in views', async () => {
      const app = () => {
        const model = createModel<{
          user: { name: string; role: string };
          permissions: string[];
          updateUser: (user: { name: string; role: string }) => void;
        }>(({ set }) => ({
          user: { name: 'John', role: 'user' },
          permissions: ['read'],
          updateUser: (user) => {
            const perms =
              user.role === 'admin' ? ['read', 'write', 'delete'] : ['read'];
            set({ user, permissions: perms });
          },
        }));

        const actions = createSlice(model, (m) => ({
          updateUser: m.updateUser,
        }));

        const userSlice = createSlice(model, (m) => m.user);
        const permSlice = createSlice(model, (m) => m.permissions);

        const profileView = createSlice(
          model,
          compose({ userSlice, permSlice }, (_m, { userSlice, permSlice }) => ({
            name: userSlice.name,
            role: userSlice.role,
            canWrite: permSlice.includes('write'),
            canDelete: permSlice.includes('delete'),
            summary: `${userSlice.name} (${userSlice.role})`,
          }))
        );

        return {
          model,
          actions,
          views: { profile: profileView },
        };
      };

      const TestComponent = defineComponent({
        setup() {
          const store = createPiniaAdapter(app);
          const profile = computed(() => store.views.profile());

          return { store, profile };
        },
        template: `
          <div>
            <div class="summary">{{ profile.summary }}</div>
            <div class="perms">
              Can write: {{ profile.canWrite }}, 
              Can delete: {{ profile.canDelete }}
            </div>
          </div>
        `,
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      expect(wrapper.find('.summary').text()).toBe('John (user)');
      expect(wrapper.find('.perms').text()).toContain('Can write: false');

      store.actions.updateUser({ name: 'Jane', role: 'admin' });
      await nextTick();

      expect(wrapper.find('.summary').text()).toBe('Jane (admin)');
      expect(wrapper.find('.perms').text()).toContain('Can write: true');
      expect(wrapper.find('.perms').text()).toContain('Can delete: true');
    });
  });

  describe('global stores', () => {
    it('should work across multiple components', async () => {
      const counter = () => {
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

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      // Create global store - Pinia handles singleton behavior

      const ComponentA = defineComponent({
        setup() {
          const store = createPiniaAdapter(counter, 'global-counter');
          const count = computed(() => store.views.count().value);
          return { count, increment: store.actions.increment };
        },
        template: `
          <div>
            <span>A: {{ count }}</span>
            <button @click="increment">A+</button>
          </div>
        `,
      });

      const ComponentB = defineComponent({
        setup() {
          const store = createPiniaAdapter(counter, 'global-counter');
          const count = computed(() => store.views.count().value);
          return { count, increment: store.actions.increment };
        },
        template: `
          <div>
            <span>B: {{ count }}</span>
            <button @click="increment">B+</button>
          </div>
        `,
      });

      const wrapperA = mount(ComponentA);
      const wrapperB = mount(ComponentB);

      expect(wrapperA.find('span').text()).toBe('A: 0');
      expect(wrapperB.find('span').text()).toBe('B: 0');

      await wrapperA.find('button').trigger('click');
      await nextTick();

      expect(wrapperA.find('span').text()).toBe('A: 1');
      expect(wrapperB.find('span').text()).toBe('B: 1');

      await wrapperB.find('button').trigger('click');
      await nextTick();

      expect(wrapperA.find('span').text()).toBe('A: 2');
      expect(wrapperB.find('span').text()).toBe('B: 2');
    });
  });

  describe('subscriptions', () => {
    it('should handle subscribe/unsubscribe', async () => {
      const counter = () => {
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

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      const TestComponent = defineComponent({
        setup() {
          const store = createPiniaAdapter(counter);
          const updates = ref<number[]>([]);

          const unsubscribe = store.subscribe(
            (views) => views.count(),
            (count) => {
              updates.value.push(count.value);
            }
          );

          return { store, updates, unsubscribe };
        },
        render() {
          return h('div');
        },
      });

      const wrapper = mount(TestComponent);
      const vm = wrapper.vm as any;

      // Should not have initial call
      expect(vm.updates).toEqual([]);

      vm.store.actions.increment();
      await nextTick();
      expect(vm.updates).toEqual([1]);

      vm.store.actions.increment();
      await nextTick();
      expect(vm.updates).toEqual([1, 2]);

      // Unsubscribe
      vm.unsubscribe();

      vm.store.actions.increment();
      await nextTick();
      // Should not receive update after unsubscribe
      expect(vm.updates).toEqual([1, 2]);
    });

    it('should only call subscribers when values change', async () => {
      const app = () => {
        const model = createModel<{
          count: number;
          name: string;
          updateCount: (n: number) => void;
          updateName: (s: string) => void;
        }>(({ set }) => ({
          count: 0,
          name: 'test',
          updateCount: (n) => set({ count: n }),
          updateName: (s) => set({ name: s }),
        }));

        const actions = createSlice(model, (m) => ({
          updateCount: m.updateCount,
          updateName: m.updateName,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
          name: createSlice(model, (m) => ({ value: m.name })),
        };

        return { model, actions, views };
      };

      const countUpdates: number[] = [];
      const nameUpdates: string[] = [];

      const TestComponent = defineComponent({
        setup() {
          const store = createPiniaAdapter(app);

          store.subscribe(
            (views) => views.count(),
            (count) => countUpdates.push(count.value)
          );

          store.subscribe(
            (views) => views.name(),
            (name) => nameUpdates.push(name.value)
          );

          return { store };
        },
        render() {
          return h('div');
        },
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      // Update count only
      store.actions.updateCount(1);
      await nextTick();

      expect(countUpdates).toEqual([1]);
      expect(nameUpdates).toEqual([]);

      // Update name only
      store.actions.updateName('changed');
      await nextTick();

      expect(countUpdates).toEqual([1]);
      expect(nameUpdates).toEqual(['changed']);

      // Update count again
      store.actions.updateCount(2);
      await nextTick();

      expect(countUpdates).toEqual([1, 2]);
      expect(nameUpdates).toEqual(['changed']);
    });
  });

  describe('Pinia integration', () => {
    it('should work with Pinia DevTools', () => {
      const counter = () => {
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

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      const store = createPiniaAdapter(counter, 'devtools-test');

      // Pinia store should have proper metadata
      expect((store as any).$id).toBe('devtools-test');
      expect((store as any).$state).toBeDefined();
      expect(typeof (store as any).$subscribe).toBe('function');
      expect(typeof (store as any).$dispose).toBe('function');
    });

    it('should support HMR through Pinia', () => {
      const counter = () => {
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

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      // Pinia automatically handles HMR if configured
      const store = createPiniaAdapter(counter, 'hmr-test');

      // Store should be properly set up for HMR
      expect(store).toBeDefined();
      expect(store.actions).toBeDefined();
    });
  });

  describe('store behavior', () => {
    it('should reuse store instances with same ID', () => {
      const counter = () => {
        const model = createModel<{ count: number; increment: () => void }>(
          ({ set, get }) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          })
        );

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      // Create first store
      const store1 = createPiniaAdapter(counter, 'cache-test-reuse');
      store1.actions.increment();

      // Create second store with same ID
      const store2 = createPiniaAdapter(counter, 'cache-test-reuse');

      // Should share the same state (Pinia ensures singleton behavior)
      expect(store2.views.count().value).toBe(1);

      // Actions should affect both stores
      store2.actions.increment();
      expect(store1.views.count().value).toBe(2);
    });

    it('should support multiple stores from the same component', () => {
      const counter = () => {
        const model = createModel<{ count: number; increment: () => void }>(
          ({ set, get }) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          })
        );

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      };

      // Create two stores from the same component with different IDs
      const store1 = createPiniaAdapter(counter, 'counter-1');
      const store2 = createPiniaAdapter(counter, 'counter-2');

      // They should have independent state
      store1.actions.increment();
      expect(store1.views.count().value).toBe(1);
      expect(store2.views.count().value).toBe(0);

      store2.actions.increment();
      store2.actions.increment();
      expect(store1.views.count().value).toBe(1);
      expect(store2.views.count().value).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should throw an error for invalid view types', () => {
      const invalidComponent = () => {
        const model = createModel<{ count: number }>(() => ({
          count: 0,
        }));

        const actions = createSlice(model, () => ({}));

        const views = {
          // This is invalid - views must be SliceFactory or function
          invalidView: 'not a valid view' as any,
        };

        return { model, actions, views };
      };

      expect(() =>
        createPiniaAdapter(invalidComponent, 'invalid-view-test')
      ).toThrowError(/Invalid view type/);
    });
  });
});

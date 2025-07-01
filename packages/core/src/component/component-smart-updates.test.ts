import { describe, it, expect } from 'vitest';
import type { ComponentContext } from './types';
import {
  createTestComponent,
  generateTodos,
  type TodoState,
} from '../testing/test-utils';

describe('Smart Updates', () => {
  describe('Array updates', () => {
    it('should support smart updates for arrays', () => {
      const TodoApp = ({
        store,
        computed,
        set,
      }: ComponentContext<TodoState>) => {
        const completed = computed(
          () => store.todos().filter((t) => t.completed).length
        );

        return {
          todos: store.todos,
          completed,
          addTodo: (text: string) => {
            const newTodo = {
              id: Date.now().toString(),
              text,
              completed: false,
            };
            set(store.todos, [...store.todos(), newTodo]);
          },
          toggleTodo: (id: string) => {
            const todoSignal = store.todos((t) => t.id === id);
            const todo = todoSignal();
            if (todo) {
              set(todoSignal, { completed: !todo.completed });
            }
          },
        };
      };

      const store = createTestComponent({
        todos: generateTodos(3),
        filter: 'all' as const,
      });
      const component = TodoApp(store);

      expect(component.completed()).toBe(0);

      // Toggle first todo
      component.toggleTodo('todo-0');
      expect(component.todos()[0]?.completed).toBe(true);
      expect(component.completed()).toBe(1);

      // Add new todo
      component.addTodo('New task');
      expect(component.todos()).toHaveLength(4);
      expect(component.completed()).toBe(1);
    });

    it('should support partial updates for derived array signals', () => {
      interface State {
        users: Array<{
          id: string;
          name: string;
          email: string;
          active: boolean;
        }>;
      }

      const UserManager = ({ store, set }: ComponentContext<State>) => ({
        users: store.users,
        updateUserEmail: (id: string, email: string) => {
          const userSignal = store.users((u) => u.id === id);
          set(userSignal, { email });
        },
        deactivateUser: (id: string) => {
          const userSignal = store.users((u) => u.id === id);
          set(userSignal, { active: false });
        },
      });

      const store = createTestComponent({
        users: [
          { id: '1', name: 'Alice', email: 'alice@example.com', active: true },
          { id: '2', name: 'Bob', email: 'bob@example.com', active: true },
        ],
      });
      const component = UserManager(store);

      component.updateUserEmail('1', 'newalice@example.com');
      const updatedUser = component.users()[0];
      expect(updatedUser?.email).toBe('newalice@example.com');
      expect(updatedUser?.name).toBe('Alice'); // Unchanged
      expect(updatedUser?.active).toBe(true); // Unchanged

      component.deactivateUser('2');
      expect(component.users()[1]?.active).toBe(false);
    });
  });

  describe('Object updates', () => {
    it('should support partial updates for objects', () => {
      interface UserState {
        user: {
          name: string;
          age: number;
          settings: {
            theme: string;
            notifications: boolean;
          };
        };
      }

      const UserProfile = ({ store, set }: ComponentContext<UserState>) => ({
        user: store.user,
        updateName: (name: string) => set(store.user, { name }),
        incrementAge: () =>
          set(store.user, (user) => ({ ...user, age: user.age + 1 })),
        toggleNotifications: () =>
          set(store.user, (user) => ({
            ...user,
            settings: {
              ...user.settings,
              notifications: !user.settings.notifications,
            },
          })),
      });

      const store = createTestComponent({
        user: {
          name: 'John',
          age: 30,
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
      });
      const component = UserProfile(store);

      component.updateName('Jane');
      expect(component.user().name).toBe('Jane');
      expect(component.user().age).toBe(30); // Unchanged

      component.incrementAge();
      expect(component.user().age).toBe(31);

      component.toggleNotifications();
      expect(component.user().settings.notifications).toBe(false);
      expect(component.user().settings.theme).toBe('dark'); // Unchanged
    });
  });

  describe.each([
    [
      'Map',
      {
        create: () =>
          new Map([
            ['key1', 'value1'],
            ['key2', 'value2'],
          ]),
        update: (map: Map<string, string>, key: string, value: string) => {
          const newMap = new Map(map);
          newMap.set(key, value);
          return newMap;
        },
        get: (map: Map<string, string>, key: string) => map.get(key),
        has: (map: Map<string, string>, key: string) => map.has(key),
      },
    ],
    [
      'Set',
      {
        create: () => new Set(['item1', 'item2', 'item3']),
        update: (set: Set<string>, _key: string, value: string) => {
          const newSet = new Set(set);
          newSet.add(value);
          return newSet;
        },
        get: (_set: Set<string>, _key: string) => true,
        has: (set: Set<string>, value: string) => set.has(value),
      },
    ],
  ])('%s updates', (collectionType, { create, update, has }) => {
    it(`should support updates for ${collectionType}`, () => {
      interface CollectionState {
        collection: any;
      }

      const CollectionComponent = ({
        store,
        set,
      }: ComponentContext<CollectionState>) => ({
        collection: store.collection,
        add: (key: string, value: string) => {
          set(store.collection, update(store.collection(), key, value));
        },
      });

      const store = createTestComponent({ collection: create() });
      const component = CollectionComponent(store);

      component.add('newKey', 'newValue');

      // For Map, check if the key exists; for Set, check if the value exists
      if (collectionType === 'Map') {
        expect(has(component.collection(), 'newKey')).toBe(true);
        expect(component.collection().get('newKey')).toBe('newValue');
      } else {
        expect(has(component.collection(), 'newValue')).toBe(true);
      }
    });
  });

  describe('Performance-critical updates', () => {
    it('should handle large array updates efficiently', () => {
      interface LargeState {
        items: Array<{ id: string; value: number }>;
      }

      const LargeComponent = ({ store, set }: ComponentContext<LargeState>) => {
        // Create derived signal for specific item
        const item5000 = store.items((item) => item.id === 'item-5000');

        return {
          items: store.items,
          item5000,
          updateTarget: () => {
            const current = item5000();
            if (current) {
              set(item5000, { ...current, value: 999 });
            }
          },
        };
      };

      const store = createTestComponent({
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: `item-${i}`,
          value: i,
        })),
      });
      const component = LargeComponent(store);

      // First access
      expect(component.item5000()?.value).toBe(5000);

      // Update should be fast
      const start = performance.now();
      component.updateTarget();
      const updateTime = performance.now() - start;

      expect(component.item5000()?.value).toBe(999);
      expect(updateTime).toBeLessThan(5); // Should be very fast
    });
  });
});

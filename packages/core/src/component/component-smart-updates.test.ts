import { describe, it, expect } from 'vitest';
import type { ComponentContext } from './types';
import {
  createTestComponent,
  generateTodos,
  type TodoState,
} from '../../testing/test-utils';

describe('Smart Updates', () => {
  describe('Array updates', () => {
    it('should support array updates', () => {
      const TodoApp = ({
        store,
        computed,
        set,
      }: ComponentContext<TodoState>) => {
        const completed = computed(
          () => store.todos.value.filter((t) => t.completed).length
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
            set(store.todos, [...store.todos.value, newTodo]);
          },
          toggleTodo: (id: string) => {
            set(store.todos, store.todos.value.map(t => 
              t.id === id ? { ...t, completed: !t.completed } : t
            ));
          },
        };
      };

      const store = createTestComponent<TodoState>({
        todos: generateTodos(3),
        filter: 'all',
      });
      const component = TodoApp(store);

      expect(component.completed.value).toBe(0);

      // Toggle first todo
      component.toggleTodo('todo-0');
      expect(component.todos.value[0]?.completed).toBe(true);
      expect(component.completed.value).toBe(1);

      // Add new todo
      component.addTodo('New task');
      expect(component.todos.value).toHaveLength(4);
      expect(component.completed.value).toBe(1);
    });
  });

  describe('Object updates', () => {
    it('should support partial updates for objects', () => {
      interface UserInfo {
        name: string;
        age: number;
        settings: {
          theme: string;
          notifications: boolean;
        };
      }
      
      interface UserState {
        user: UserInfo;
      }

      const UserProfile = ({ store, set }: ComponentContext<UserState>) => ({
        user: store.user,
        updateName: (name: string) => set(store.user, { name }),
        incrementAge: () =>
          set(store.user, (user: UserInfo) => ({ ...user, age: user.age + 1 })),
        toggleNotifications: () =>
          set(store.user, (user: UserInfo) => ({
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
      expect(component.user.value.name).toBe('Jane');
      expect(component.user.value.age).toBe(30); // Unchanged

      component.incrementAge();
      expect(component.user.value.age).toBe(31);

      component.toggleNotifications();
      expect(component.user.value.settings.notifications).toBe(false);
      expect(component.user.value.settings.theme).toBe('dark'); // Unchanged
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
        update: (collection: Map<string, string> | Set<string>, key: string, value: string) => {
          const map = collection as Map<string, string>;
          const newMap = new Map(map);
          newMap.set(key, value);
          return newMap;
        },
        get: (collection: Map<string, string> | Set<string>, key: string) => {
          const map = collection as Map<string, string>;
          return map.get(key);
        },
        has: (collection: Map<string, string> | Set<string>, key: string) => {
          const map = collection as Map<string, string>;
          return map.has(key);
        },
      },
    ],
    [
      'Set',
      {
        create: () => new Set(['item1', 'item2', 'item3']),
        update: (collection: Map<string, string> | Set<string>, _key: string, value: string) => {
          const set = collection as Set<string>;
          const newSet = new Set(set);
          newSet.add(value);
          return newSet;
        },
        get: () => true,
        has: (collection: Map<string, string> | Set<string>, value: string) => {
          const set = collection as Set<string>;
          return set.has(value);
        },
      },
    ],
  ])('%s updates', (collectionType, { create, update, has }) => {
    it(`should support updates for ${collectionType}`, () => {
      interface CollectionState {
        collection: Map<string, string> | Set<string>;
      }

      const CollectionComponent = ({
        store,
        set,
      }: ComponentContext<CollectionState>) => ({
        collection: store.collection,
        add: (key: string, value: string) => {
          const current = store.collection.value;
          if (current instanceof Map) {
            const updatedValue = update(current, key, value);
            set(store.collection, updatedValue);
          } else if (current instanceof Set) {
            const updatedValue = update(current, key, value);
            set(store.collection, updatedValue);
          }
        },
      });

      const store = createTestComponent({ collection: create() });
      const component = CollectionComponent(store);

      component.add('newKey', 'newValue');

      // For Map, check if the key exists; for Set, check if the value exists
      const collection = component.collection.value;
      if (collectionType === 'Map' && collection instanceof Map) {
        expect(has(collection, 'newKey')).toBe(true);
        expect(collection.get('newKey')).toBe('newValue');
      } else if (collection instanceof Set) {
        expect(has(collection, 'newValue')).toBe(true);
      }
    });
  });

});

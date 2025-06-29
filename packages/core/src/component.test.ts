import { describe, it, expect, vi } from 'vitest';
import { createComponent, withState, createStore } from './component';
import { withLogger } from './middleware';

describe('Component API', () => {
  it('should create a component with inferred state from callback', () => {
    const Counter = createComponent(
      withState(() => ({ count: 0 })),
      ({ store, computed, set }) => {
        const doubled = computed(() => store.count() * 2);

        return {
          count: store.count,
          doubled,
          increment: () => set(store.count, store.count() + 1),
          reset: () => set({ count: 0 }),
        };
      }
    );

    const store = createStore(Counter, { count: 5 });

    expect(store.count()).toBe(5);
    expect(store.doubled()).toBe(10);

    store.increment();
    expect(store.count()).toBe(6);
    expect(store.doubled()).toBe(12);

    store.reset();
    expect(store.count()).toBe(0);
    expect(store.doubled()).toBe(0);
  });

  it('should support middleware composition with new pattern', () => {
    const Counter = createComponent(
      withLogger(withState(() => ({ count: 0 }))),
      ({ store, set }) => ({
        count: store.count,
        increment: () => set({ count: store.count() + 1 }),
      })
    );

    const store = createStore(Counter, { count: 5 });

    // Spy on console.log to verify logger works
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    store.increment();
    expect(store.count()).toBe(6);
    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', {
      count: 6,
    });

    consoleSpy.mockRestore();
  });

  it('should support composition with new API', () => {
    const SubCounter = createComponent(
      withState(() => ({ subCount: 0 })),
      ({ store, set }) => ({
        value: store.subCount,
        inc: () => set({ subCount: store.subCount() + 1 }),
      })
    );

    const App = createComponent(
      withState(() => ({ subCount: 0, multiplier: 2 })),
      (context) => {
        const sub = SubCounter(context);
        const total = context.computed(
          () => sub.value() * context.store.multiplier()
        );

        return {
          counter: sub,
          multiplier: context.store.multiplier,
          total,
          setMultiplier: (n: number) => context.set({ multiplier: n }),
        };
      }
    );

    const store = createStore(App, { subCount: 5, multiplier: 3 });
    expect(store.total()).toBe(15);

    store.counter.inc();
    expect(store.total()).toBe(18);

    store.setMultiplier(2);
    expect(store.total()).toBe(12);
  });

  it('should properly track dependencies in computed values', () => {
    type TodoState = { todos: string[]; filter: 'all' | 'active' | 'done' };

    const TodoApp = createComponent(
      withState<TodoState>(),
      ({ store, computed, set }) => {
        const filtered = computed(() => {
          const f = store.filter();
          const t = store.todos();
          if (f === 'all') return t;
          // Simplified for test
          return t.filter((todo: string) =>
            f === 'active' ? !todo.includes('[done]') : todo.includes('[done]')
          );
        });

        return {
          todos: store.todos,
          filter: store.filter,
          filtered,
          addTodo: (text: string) => set({ todos: [...store.todos(), text] }),
          setFilter: (f: 'all' | 'active' | 'done') => set({ filter: f }),
        };
      }
    );

    const store = createStore(TodoApp, { todos: [], filter: 'all' });

    store.addTodo('Buy milk');
    store.addTodo('[done] Read book');

    expect(store.filtered()).toEqual(['Buy milk', '[done] Read book']);

    store.setFilter('active');
    expect(store.filtered()).toEqual(['Buy milk']);

    store.setFilter('done');
    expect(store.filtered()).toEqual(['[done] Read book']);
  });

  it('should support fine-grained subscriptions', () => {
    type CounterState = { count: number; name: string };

    const Counter = createComponent(
      withState<CounterState>(),
      ({ store, set }) => {
        return {
          count: store.count,
          name: store.name,
          increment: () => set({ count: store.count() + 1 }),
          setName: (n: string) => set({ name: n }),
        };
      }
    );

    const store = createStore(Counter, { count: 0, name: 'initial' });

    let countUpdates = 0;
    let nameUpdates = 0;

    const unsubCount = store.count.subscribe(() => countUpdates++);
    const unsubName = store.name.subscribe(() => nameUpdates++);

    store.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(0);

    store.setName('updated');
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);

    unsubCount();
    unsubName();

    store.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);
  });

  it('should support smart updates for arrays', () => {
    interface TodoState {
      todos: Array<{ id: string; text: string; completed: boolean }>;
    }

    const TodoApp = createComponent(
      withState<TodoState>(),
      ({ store, computed, set }) => {
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
            set({ todos: [...store.todos(), newTodo] });
          },
          // Use smart update to toggle a specific todo
          toggleTodo: (id: string) => {
            const todo = store.todos((t) => t.id === id);
            if (todo) {
              const todos = store.todos();
              const index = todos.findIndex(t => t.id === id);
              if (index >= 0) {
                const updated = [...todos];
                updated[index] = { ...todo, completed: !todo.completed };
                store.todos(updated);
              }
            }
          },
        };
      }
    );

    const store = createStore(TodoApp, {
      todos: [
        { id: '1', text: 'First', completed: false },
        { id: '2', text: 'Second', completed: true },
        { id: '3', text: 'Third', completed: false },
      ],
    });

    expect(store.completed()).toBe(1);

    // Toggle first todo
    store.toggleTodo('1');
    expect(store.todos()[0]!.completed).toBe(true);
    expect(store.completed()).toBe(2);

    // Toggle second todo
    store.toggleTodo('2');
    expect(store.todos()[1]!.completed).toBe(false);
    expect(store.completed()).toBe(1);

    // Add new todo
    store.addTodo('Fourth');
    expect(store.todos().length).toBe(4);
    expect(store.completed()).toBe(1);
  });

  it('should support index-based smart updates', () => {
    interface ListState {
      items: string[];
    }

    const List = createComponent(withState<ListState>(), ({ store }) => ({
      items: store.items,
      // Update by index directly
      updateByIndex: (index: number, newValue: string) => {
        const items = [...store.items()];
        if (index >= 0 && index < items.length) {
          items[index] = newValue;
          store.items(items);
        }
      },
      // Insert after specific index
      insertAfter: (index: number, newValue: string) => {
        // Just use regular set for insertion
        const items = store.items();
        store.items([
          ...items.slice(0, index + 1),
          newValue,
          ...items.slice(index + 1),
        ]);
      },
      // Swap items by index
      swap: (indexA: number, indexB: number) => {
        const items = [...store.items()];
        if (
          indexA >= 0 &&
          indexA < items.length &&
          indexB >= 0 &&
          indexB < items.length
        ) {
          [items[indexA], items[indexB]] = [items[indexB]!, items[indexA]!];
          store.items(items);
        }
      },
    }));

    const store = createStore(List, {
      items: ['first', 'second', 'third', 'fourth'],
    });

    // Update by index
    store.updateByIndex(1, 'SECOND');
    expect(store.items()).toEqual(['first', 'SECOND', 'third', 'fourth']);

    // Insert after index
    store.insertAfter(1, 'inserted');
    expect(store.items()).toEqual([
      'first',
      'SECOND',
      'inserted',
      'third',
      'fourth',
    ]);

    // Swap items
    store.swap(0, 4);
    expect(store.items()).toEqual([
      'fourth',
      'SECOND',
      'inserted',
      'third',
      'first',
    ]);
  });

  it('should support smart updates for objects', () => {
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

    const UserProfile = createComponent(
      withState<UserState>(),
      ({ store }) => ({
        user: store.user,
        updateName: (name: string) => {
          store.user('name', () => name);
        },
        incrementAge: () => {
          store.user('age', (age) => age + 1);
        },
        toggleNotifications: () => {
          store.user('settings', (settings) => ({
            ...settings,
            notifications: !settings.notifications,
          }));
        },
      })
    );

    const store = createStore(UserProfile, {
      user: {
        name: 'John',
        age: 30,
        settings: {
          theme: 'dark',
          notifications: true,
        },
      },
    });

    expect(store.user().name).toBe('John');
    expect(store.user().age).toBe(30);

    store.updateName('Jane');
    expect(store.user().name).toBe('Jane');

    store.incrementAge();
    expect(store.user().age).toBe(31);

    store.toggleNotifications();
    expect(store.user().settings.notifications).toBe(false);
  });

  it('should support smart updates for object collections', () => {
    interface UsersState {
      users: Record<string, { name: string; age: number; active: boolean }>;
    }

    const UsersManager = createComponent(
      withState<UsersState>(),
      ({ store }) => ({
        users: store.users,
        // Update user by finding with predicate
        deactivateOldUsers: (maxAge: number) => {
          const users = store.users();
          const userKey = Object.keys(users).find(
            key => users[key]!.age > maxAge && users[key]!.active
          );
          if (userKey) {
            store.users({ ...users, [userKey]: { ...users[userKey]!, active: false } });
          }
        },
        // Update specific user by key using string selector
        updateUserAge: (userId: string, age: number) => {
          store.users(userId, (user) => ({ ...user, age }));
        },
        // Find and update by property value
        promoteUser: (name: string) => {
          const users = store.users();
          const userKey = Object.keys(users).find(
            key => users[key]!.name === name
          );
          if (userKey) {
            const user = users[userKey]!;
            store.users({
              ...users,
              [userKey]: {
                ...user,
                name: `${user.name} (promoted)`,
                age: user.age + 1,
              }
            });
          }
        },
      })
    );

    const store = createStore(UsersManager, {
      users: {
        user1: { name: 'Alice', age: 25, active: true },
        user2: { name: 'Bob', age: 35, active: true },
        user3: { name: 'Charlie', age: 45, active: true },
        user4: { name: 'Dave', age: 55, active: true },
      },
    });

    // Deactivate users over 40
    store.deactivateOldUsers(40);
    expect(store.users().user1?.active).toBe(true);
    expect(store.users().user2?.active).toBe(true);
    expect(store.users().user3?.active).toBe(false); // First match only
    expect(store.users().user4?.active).toBe(true); // Not updated

    // Update specific user by key
    store.updateUserAge('user2', 36);
    expect(store.users().user2?.age).toBe(36);

    // Find and update by name
    store.promoteUser('Alice');
    expect(store.users().user1?.name).toBe('Alice (promoted)');
    expect(store.users().user1?.age).toBe(26);
  });

  it('should support smart updates for Maps', () => {
    interface MapState {
      userRoles: Map<string, string>;
      scores: Map<string, number>;
    }

    const MapExample = createComponent(
      withState<MapState>(),
      ({ store }) => ({
        userRoles: store.userRoles,
        scores: store.scores,
        // Update by key
        setUserRole: (userId: string, role: string) => {
          store.userRoles(userId, () => role);
        },
        // Update score with computation
        incrementScore: (userId: string, points: number) => {
          store.scores(userId, (current) => current + points);
        },
        // Find and update by value predicate
        promoteAllManagers: () => {
          const role = store.userRoles((role) => role === 'manager');
          if (role !== undefined) {
            const userRoles = new Map(store.userRoles());
            for (const [key, val] of userRoles) {
              if (val === 'manager') {
                userRoles.set(key, 'senior-manager');
                break; // Only first match
              }
            }
            store.userRoles(userRoles);
          }
        },
      })
    );

    const store = createStore(MapExample, {
      userRoles: new Map([
        ['user1', 'admin'],
        ['user2', 'manager'],
        ['user3', 'viewer'],
        ['user4', 'manager'],
      ]),
      scores: new Map([
        ['user1', 100],
        ['user2', 50],
        ['user3', 25],
      ]),
    });

    // Update by key
    store.setUserRole('user3', 'editor');
    expect(store.userRoles().get('user3')).toBe('editor');

    // Update with computation
    store.incrementScore('user2', 30);
    expect(store.scores().get('user2')).toBe(80);

    // Update by predicate (only first match)
    store.promoteAllManagers();
    expect(store.userRoles().get('user2')).toBe('senior-manager');
    expect(store.userRoles().get('user4')).toBe('manager'); // Not updated (only first match)
  });

  it('should support smart updates for Sets', () => {
    interface SetState {
      tags: Set<string>;
      selectedIds: Set<number>;
    }

    const SetExample = createComponent(
      withState<SetState>(),
      ({ store }) => ({
        tags: store.tags,
        selectedIds: store.selectedIds,
        // Add single item
        addTag: (tag: string) => {
          store.tags(tag); // Single argument add
        },
        // Add with command
        addSelectedId: (id: number) => {
          store.selectedIds('add', id);
        },
        // Toggle item
        toggleTag: (tag: string) => {
          store.tags('toggle', tag);
        },
        // Delete by predicate
        removeShortTags: () => {
          store.tags('delete', (tag: string) => tag.length < 3);
        },
        // Update matching items
        uppercaseTag: (target: string) => {
          const found = store.tags((tag) => tag === target);
          if (found) {
            const tags = new Set(store.tags());
            tags.delete(found);
            tags.add(found.toUpperCase());
            store.tags(tags);
          }
        },
      })
    );

    const store = createStore(SetExample, {
      tags: new Set(['react', 'js', 'ts', 'vue']),
      selectedIds: new Set([1, 2, 3]),
    });

    // Add tag
    store.addTag('angular');
    expect(store.tags().has('angular')).toBe(true);
    expect(store.tags().size).toBe(5);

    // Toggle tag (remove existing)
    store.toggleTag('vue');
    expect(store.tags().has('vue')).toBe(false);
    expect(store.tags().size).toBe(4);

    // Toggle tag (add non-existing)
    store.toggleTag('svelte');
    expect(store.tags().has('svelte')).toBe(true);
    expect(store.tags().size).toBe(5);

    // Delete by predicate
    store.removeShortTags();
    expect(store.tags().has('js')).toBe(false);
    expect(store.tags().has('ts')).toBe(false);
    expect(store.tags().has('react')).toBe(true);

    // Update matching item
    store.uppercaseTag('react');
    expect(store.tags().has('react')).toBe(false);
    expect(store.tags().has('REACT')).toBe(true);
  });
});

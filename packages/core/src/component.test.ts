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
          reset: () => set(store.count, 0),
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
        increment: () => set(store.count, store.count() + 1),
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
        inc: () => set(store.subCount, store.subCount() + 1),
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
          setMultiplier: (n: number) =>
            context.set(context.store.multiplier, n),
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
          addTodo: (text: string) => set(store.todos, [...store.todos(), text]),
          setFilter: (f: 'all' | 'active' | 'done') => set(store.filter, f),
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
          increment: () => set(store.count, store.count() + 1),
          setName: (n: string) => set(store.name, n),
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
            set(store.todos, [...store.todos(), newTodo]);
          },
          // Use smart update to toggle a specific todo
          toggleTodo: (id: string) => {
            const todoSignal = store.todos(
              (t: { id: string; text: string; completed: boolean }) =>
                t.id === id
            );
            const todo = todoSignal();

            // Use set on the derived signal directly for O(1) update
            set(todoSignal, { completed: !todo?.completed });
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

  it('should support partial updates for derived signals', () => {
    interface State {
      users: Array<{
        id: string;
        name: string;
        email: string;
        active: boolean;
        lastSeen: number;
      }>;
    }

    const UserManager = createComponent(
      withState<State>(),
      ({ store, set }) => ({
        users: store.users,
        // Test partial update on derived signal
        updateActiveUserLastSeen: () => {
          const activeUser = store.users((u) => u.active);
          // This should do a partial update, keeping other fields intact
          set(activeUser, { lastSeen: Date.now() });
        },
        // Test partial update with multiple fields on derived signal
        updateUserByIdPartial: (id: string, name: string, email: string) => {
          const userSignal = store.users((u) => u.id === id);
          // Update only name and email, preserving other fields
          set(userSignal, { name, email });
        },
        // Test update function on derived signal for comparison
        deactivateUserById: (id: string) => {
          const userSignal = store.users((u) => u.id === id);

          set(userSignal, (u) => ({
            ...u,
            active: false,
            lastSeen: Date.now(),
          }));
        },
      })
    );

    const store = createStore(UserManager, {
      users: [
        {
          id: '1',
          name: 'Alice',
          email: 'alice@example.com',
          active: true,
          lastSeen: 1000,
        },
        {
          id: '2',
          name: 'Bob',
          email: 'bob@example.com',
          active: false,
          lastSeen: 2000,
        },
        {
          id: '3',
          name: 'Charlie',
          email: 'charlie@example.com',
          active: false,
          lastSeen: 3000,
        },
      ],
    });

    // Test partial update on derived signal - only lastSeen should change
    store.updateActiveUserLastSeen();
    const updatedActiveUser = store.users()[0];

    expect(updatedActiveUser!.id).toBe('1');
    expect(updatedActiveUser!.name).toBe('Alice');
    expect(updatedActiveUser!.email).toBe('alice@example.com');
    expect(updatedActiveUser!.active).toBe(true);
    expect(updatedActiveUser!.lastSeen).toBeGreaterThan(1000);

    // Test partial update with multiple fields
    store.updateUserByIdPartial('2', 'Robert', 'robert@example.com');
    const updatedUser2 = store.users()[1];

    expect(updatedUser2!.id).toBe('2');
    expect(updatedUser2!.name).toBe('Robert');
    expect(updatedUser2!.email).toBe('robert@example.com');
    expect(updatedUser2!.active).toBe(false); // Should remain unchanged
    expect(updatedUser2!.lastSeen).toBe(2000); // Should remain unchanged

    // Test update function pattern
    const beforeDeactivate = store.users()[2];
    store.deactivateUserById('3');
    const afterDeactivate = store.users()[2];

    expect(afterDeactivate!.id).toBe('3');
    expect(afterDeactivate!.name).toBe('Charlie'); // Should remain unchanged
    expect(afterDeactivate!.email).toBe('charlie@example.com'); // Should remain unchanged
    expect(afterDeactivate!.active).toBe(false);
    expect(afterDeactivate!.lastSeen).toBeGreaterThan(
      beforeDeactivate!.lastSeen
    );
  });

  it('should support index-based smart updates', () => {
    interface ListState {
      items: string[];
    }

    const List = createComponent(withState<ListState>(), ({ store, set }) => ({
      items: store.items,
      // Update by index directly
      updateByIndex: (index: number, newValue: string) => {
        const items = [...store.items()];
        if (index >= 0 && index < items.length) {
          items[index] = newValue;
          set(store.items, items);
        }
      },
      // Insert after specific index
      insertAfter: (index: number, newValue: string) => {
        // Just use regular set for insertion
        const items = store.items();
        set(store.items, [
          ...items.slice(0, index + 1),
          newValue,
          ...items.slice(index + 1),
        ]);
      },
      // Swap items by index
      swap: (indexA: number, indexB: number) => {
        const items = store.items();
        if (
          indexA >= 0 &&
          indexA < items.length &&
          indexB >= 0 &&
          indexB < items.length
        ) {
          [items[indexA], items[indexB]] = [items[indexB]!, items[indexA]!];
          set(store.items, items);
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
      ({ store, set }) => ({
        user: store.user,
        updateName: (name: string) => {
          set(store.user, { name });
        },
        incrementAge: () => {
          set(store.user, (user) => ({ ...user, age: user.age + 1 }));
        },
        toggleNotifications: () => {
          set(store.user, (user) => ({
            ...user,
            settings: {
              ...user.settings,
              notifications: !user.settings.notifications,
            },
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

  it('should support partial updates for object signals', () => {
    interface UserState {
      user: {
        id: string;
        name: string;
        email: string;
        lastSeen: number;
        preferences: {
          theme: 'light' | 'dark';
          language: string;
        };
      };
    }

    const UserComponent = createComponent(
      withState<UserState>(),
      ({ store, set }) => ({
        user: store.user,
        // Test partial update - only updating specific fields
        updateLastSeen: () => {
          set(store.user, { lastSeen: Date.now() });
        },
        // Test partial update with nested object
        updateTheme: (theme: 'light' | 'dark') => {
          set(store.user, {
            // You shouldn't normally do this (reading store.user() unnecessarily)
            // but good to test anyway
            preferences: { ...store.user().preferences, theme },
          });
        },
        // Test partial update with multiple fields
        updateProfile: (name: string, email: string) => {
          set(store.user, { name, email });
        },
        // Test update function pattern for comparison
        updateLanguageWithFunction: (language: string) => {
          set(store.user, (user) => ({
            ...user,
            preferences: { ...user.preferences, language },
          }));
        },
      })
    );

    const store = createStore(UserComponent, {
      user: {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        lastSeen: 1000,
        preferences: {
          theme: 'light',
          language: 'en',
        },
      },
    });

    // Test partial update - only lastSeen should change
    store.updateLastSeen();
    const afterLastSeen = store.user();
    expect(afterLastSeen.id).toBe('123');
    expect(afterLastSeen.name).toBe('John Doe');
    expect(afterLastSeen.email).toBe('john@example.com');
    expect(afterLastSeen.lastSeen).toBeGreaterThan(1000);
    expect(afterLastSeen.preferences).toEqual({
      theme: 'light',
      language: 'en',
    });

    // Test partial update with multiple fields
    store.updateProfile('Jane Doe', 'jane@example.com');
    const afterProfile = store.user();
    expect(afterProfile.id).toBe('123');
    expect(afterProfile.name).toBe('Jane Doe');
    expect(afterProfile.email).toBe('jane@example.com');
    expect(afterProfile.lastSeen).toBe(afterLastSeen.lastSeen); // Should remain unchanged
    expect(afterProfile.preferences).toEqual({
      theme: 'light',
      language: 'en',
    });

    // Test nested partial update
    store.updateTheme('dark');
    const afterTheme = store.user();
    expect(afterTheme.preferences.theme).toBe('dark');
    expect(afterTheme.preferences.language).toBe('en'); // Should remain unchanged

    // Test update function pattern
    store.updateLanguageWithFunction('es');
    const afterLanguage = store.user();
    expect(afterLanguage.preferences.language).toBe('es');
    expect(afterLanguage.preferences.theme).toBe('dark'); // Should remain unchanged
  });

  it('should support smart updates for object collections', () => {
    interface UsersState {
      users: Record<string, { name: string; age: number; active: boolean }>;
    }

    const UsersManager = createComponent(
      withState<UsersState>(),
      ({ store, set }) => ({
        users: store.users,
        // Update user by finding with predicate
        deactivateOldUsers: (maxAge: number) => {
          const users = store.users();
          const userKey = Object.keys(users).find(
            (key) => users[key]!.age > maxAge && users[key]!.active
          );
          if (userKey) {
            set(store.users, (users) => ({
              ...users,
              [userKey]: { ...users[userKey]!, active: false },
            }));
          }
        },
        // Update specific user by key
        updateUserAge: (userId: string, age: number) => {
          set(store.users, (users) => ({
            ...users,
            [userId]: { ...users[userId]!, age },
          }));
        },
        // Find and update by property value
        promoteUser: (name: string) => {
          const users = store.users();
          const userKey = Object.keys(users).find(
            (key) => users[key]!.name === name
          );
          if (userKey) {
            const user = users[userKey]!;
            set(store.users, {
              ...users,
              [userKey]: {
                ...user,
                name: `${user.name} (promoted)`,
                age: user.age + 1,
              },
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
      ({ store, set }) => ({
        userRoles: store.userRoles,
        scores: store.scores,
        // Update by key
        setUserRole: (userId: string, role: string) => {
          const userRoles = new Map(store.userRoles());
          userRoles.set(userId, role);
          set(store.userRoles, userRoles);
        },
        // Update score with computation
        incrementScore: (userId: string, points: number) => {
          const scores = new Map(store.scores());
          const current = scores.get(userId) || 0;
          scores.set(userId, current + points);
          set(store.scores, scores);
        },
        // Find and update by value predicate
        promoteAllManagers: () => {
          const userRoles = new Map(store.userRoles());
          for (const [key, val] of userRoles) {
            if (val === 'manager') {
              userRoles.set(key, 'senior-manager');
              set(store.userRoles, userRoles);
              break; // Only first match
            }
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
      ({ store, set }) => ({
        tags: store.tags,
        selectedIds: store.selectedIds,
        // Add single item
        addTag: (tag: string) => {
          const tags = new Set(store.tags());
          tags.add(tag);
          set(store.tags, tags);
        },
        // Add with command
        addSelectedId: (id: number) => {
          const selectedIds = new Set(store.selectedIds());
          selectedIds.add(id);
          set(store.selectedIds, selectedIds);
        },
        // Toggle item
        toggleTag: (tag: string) => {
          const tags = new Set(store.tags());
          if (tags.has(tag)) {
            tags.delete(tag);
          } else {
            tags.add(tag);
          }
          set(store.tags, tags);
        },
        // Delete by predicate
        removeShortTags: () => {
          const tags = new Set(store.tags());
          for (const tag of tags) {
            if (tag.length < 3) {
              tags.delete(tag);
            }
          }
          set(store.tags, tags);
        },
        // Update matching items
        uppercaseTag: (target: string) => {
          const foundSignal = store.tags((tag: string) => tag === target);
          const found = foundSignal();
          if (found) {
            const tags = new Set(store.tags());
            tags.delete(found);
            tags.add(found.toUpperCase());
            set(store.tags, tags);
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

  describe('Derived Signal Performance', () => {
    it('should update derived signals in O(1) time with cached position', () => {
      const TodoApp = createComponent(
        withState(() => ({
          todos: Array.from({ length: 10000 }, (_, i) => ({
            id: `todo-${i}`,
            text: `Task ${i}`,
            completed: false,
          })),
        })),
        ({ store, set }) => {
          // Create derived signal for specific todo
          const targetTodo = store.todos((t) => t.id === 'todo-5000');

          return {
            todos: store.todos,
            targetTodo,
            updateTarget: () => {
              // This should be O(1) after first access
              const current = targetTodo();
              if (current) {
                set(targetTodo, { ...current, completed: true });
              }
            },
            moveTarget: () => {
              // Move todo to different position, cache should invalidate
              const todos = store.todos();
              const idx = todos.findIndex((t) => t.id === 'todo-5000');
              if (idx !== -1) {
                const todo = todos[idx];
                const newTodos = [...todos];
                newTodos.splice(idx, 1);
                todo && newTodos.unshift(todo);
                set(store.todos, newTodos);
              }
            },
          };
        }
      );

      const store = createStore(TodoApp, {
        todos: Array.from({ length: 10000 }, (_, i) => ({
          id: `todo-${i}`,
          text: `Task ${i}`,
          completed: false,
        })),
      });

      // First access - O(n) to find and cache position
      const todo1 = store.targetTodo();
      expect(todo1?.id).toBe('todo-5000');
      expect(todo1?.completed).toBe(false);

      // Measure update performance - should be O(1)
      const start = performance.now();
      store.updateTarget();
      const updateTime = performance.now() - start;

      // Verify update worked
      const todo2 = store.targetTodo();
      expect(todo2?.completed).toBe(true);

      // Update time should be very fast (< 1ms) regardless of array size
      expect(updateTime).toBeLessThan(1);

      // After moving, cache should be invalidated
      store.moveTarget();
      const todo3 = store.targetTodo();
      expect(todo3?.id).toBe('todo-5000');
      expect(store.todos()[0]?.id).toBe('todo-5000');
    });

    it('should handle keyed selectors with O(1) updates', () => {
      const UserStore = createComponent(
        withState(() => ({
          users: Array.from({ length: 1000 }, (_, i) => ({
            id: `user-${i}`,
            name: `User ${i}`,
            score: i,
          })),
        })),
        ({ store, set }) => {
          // Keyed selector for efficient lookups
          const userById = store.users(
            (id: string) => id,
            (user, id) => user.id === id
          );

          return {
            users: store.users,
            userById,
            updateUserScore: (id: string, score: number) => {
              const user = userById(id)();
              if (user) {
                set(userById(id), { ...user, score });
              }
            },
          };
        }
      );

      const store = createStore(UserStore, {
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: `user-${i}`,
          name: `User ${i}`,
          score: i,
        })),
      });

      // Multiple keyed lookups should each be cached
      const user1 = store.userById('user-100')();
      const user2 = store.userById('user-500')();
      const user3 = store.userById('user-900')();

      expect(user1?.name).toBe('User 100');
      expect(user2?.name).toBe('User 500');
      expect(user3?.name).toBe('User 900');

      // Update multiple users - each should be O(1)
      const times: number[] = [];

      for (const id of ['user-100', 'user-500', 'user-900']) {
        const start = performance.now();
        store.updateUserScore(id, 999);
        times.push(performance.now() - start);
      }

      // All updates should be fast
      times.forEach((time) => expect(time).toBeLessThan(1));

      // Verify updates
      expect(store.userById('user-100')()?.score).toBe(999);
      expect(store.userById('user-500')()?.score).toBe(999);
      expect(store.userById('user-900')()?.score).toBe(999);
    });

    it('should handle cache invalidation when source changes', () => {
      const ItemStore = createComponent(
        withState(() => ({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' },
          ],
        })),
        ({ store, set }) => {
          const item2 = store.items((item) => item.id === 2);

          return {
            items: store.items,
            item2,
            updateItem2: (name: string) => {
              const current = item2();
              if (current) {
                set(item2, { ...current, name });
              }
            },
            replaceItems: (items: { id: number; name: string }[]) =>
              set(store.items, items),
          };
        }
      );

      const store = createStore(ItemStore, {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' },
        ],
      });

      // Initial access
      expect(store.item2()?.name).toBe('Item 2');

      // Update through derived signal
      store.updateItem2('Updated Item 2');
      expect(store.item2()?.name).toBe('Updated Item 2');

      // Replace entire array - cache should handle gracefully
      store.replaceItems([
        { id: 4, name: 'Item 4' },
        { id: 2, name: 'New Item 2' },
        { id: 5, name: 'Item 5' },
      ]);

      // Should find new item with id 2
      expect(store.item2()?.name).toBe('New Item 2');

      // Remove item 2
      store.replaceItems([
        { id: 4, name: 'Item 4' },
        { id: 5, name: 'Item 5' },
      ]);

      // Should return undefined
      expect(store.item2()).toBeUndefined();
    });

    it('should handle error cases gracefully', () => {
      const ErrorStore = createComponent(
        withState(() => ({
          items: [
            { id: 1, value: 10 },
            { id: 2, value: 20 },
            { id: 3, value: 30 },
          ],
        })),
        ({ store, set }) => {
          // Predicate that can throw
          const riskyItem = store.items((item) => {
            if (item.value === 20) {
              throw new Error('Test error in predicate');
            }
            return item.id === 2;
          });

          // Non-existent item
          const missingItem = store.items((item) => item.id === 999);

          return {
            items: store.items,
            riskyItem,
            missingItem,
            updateMissing: () => {
              const item = missingItem();
              if (item) {
                set(missingItem, { ...item, value: 100 });
              }
            },
            getRisky: () => {
              try {
                return riskyItem();
              } catch (e) {
                return null;
              }
            },
          };
        }
      );

      const store = createStore(ErrorStore, {
        items: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 30 },
        ],
      });

      // Non-existent item should return undefined
      expect(store.missingItem()).toBeUndefined();

      // Updating non-existent item should be a no-op
      store.updateMissing();
      expect(store.items().length).toBe(3);

      // Predicate that throws should propagate error
      expect(() => store.riskyItem()).toThrow('Test error in predicate');
      expect(store.getRisky()).toBeNull();
    });

    it('should handle concurrent updates correctly', () => {
      const ConcurrentStore = createComponent(
        withState(() => ({
          counter: { value: 0 },
          items: [
            { id: 1, count: 0 },
            { id: 2, count: 0 },
          ],
        })),
        ({ store, set }) => {
          const item1 = store.items((item) => item.id === 1);
          const item2 = store.items((item) => item.id === 2);

          return {
            counter: store.counter,
            items: store.items,
            item1,
            item2,
            updateBoth: () => {
              // Concurrent updates to different derived signals
              const i1 = item1();
              const i2 = item2();
              if (i1 && i2) {
                set(item1, { ...i1, count: i1.count + 1 });
                set(item2, { ...i2, count: i2.count + 1 });
              }
            },
            updateCounter: () => {
              // Multiple updates to same signal
              set(store.counter, { value: store.counter().value + 1 });
              set(store.counter, { value: store.counter().value + 1 });
              set(store.counter, { value: store.counter().value + 1 });
            },
          };
        }
      );

      const store = createStore(ConcurrentStore, {
        counter: { value: 0 },
        items: [
          { id: 1, count: 0 },
          { id: 2, count: 0 },
        ],
      });

      // Concurrent updates to different items
      store.updateBoth();
      expect(store.item1()?.count).toBe(1);
      expect(store.item2()?.count).toBe(1);

      // Multiple updates in same batch
      store.updateCounter();
      expect(store.counter().value).toBe(3);

      // Verify items array is still consistent
      const items = store.items();
      expect(items[0]?.count).toBe(1);
      expect(items[1]?.count).toBe(1);
    });
  });
});

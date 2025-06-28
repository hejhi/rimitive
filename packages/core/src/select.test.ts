import { describe, it, expect } from 'vitest';
import { createComponent, withState, createStore } from './component';

describe('Select API Caching', () => {
  it('should cache objects and provide O(1) lookups', () => {
    interface User {
      id: string;
      name: string;
      email: string;
      age: number;
    }

    interface State {
      users: User[];
    }

    const UserStore = createComponent(
      withState<State>(),
      ({ store, select, set }) => {
        // Create selectors
        const userById = select((id: string) => 
          store.users((user: User) => user.id === id)
        );
        
        const userByEmail = select((email: string) =>
          store.users((user: User) => user.email === email)
        );

        return {
          users: store.users,
          getUserById: userById,
          getUserByEmail: userByEmail,
          updateUserById: (id: string, updates: Partial<User>) => {
            set(userById(id), updates);
          },
          updateUserByEmail: (email: string, updates: Partial<User>) => {
            set(userByEmail(email), updates);
          },
        };
      }
    );

    const store = createStore(UserStore, {
      users: [
        { id: '1', name: 'Alice', email: 'alice@example.com', age: 25 },
        { id: '2', name: 'Bob', email: 'bob@example.com', age: 30 },
        { id: '3', name: 'Charlie', email: 'charlie@example.com', age: 35 },
      ],
    });

    // First lookup by ID - O(n)
    const user1 = store.getUserById('1');
    expect(user1.value).toEqual({
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
    });

    // Lookup same user by email - should be O(1) due to cache!
    const user1ByEmail = store.getUserByEmail('alice@example.com');
    expect(user1ByEmail.value).toBe(user1.value); // Same reference!

    // Update via ID selector
    store.updateUserById('1', { age: 26 });
    expect(store.users()[0].age).toBe(26);

    // Update via email selector (different selector, same object)
    store.updateUserByEmail('alice@example.com', { name: 'Alice Smith' });
    expect(store.users()[0].name).toBe('Alice Smith');
  });

  it('should maintain cache across immutable updates that preserve references', () => {
    interface State {
      users: Array<{ id: string; name: string; active: boolean }>;
    }

    const Store = createComponent(
      withState<State>(),
      ({ store, select, set }) => {
        const userById = select((id: string) =>
          store.users((u) => u.id === id)
        );

        return {
          users: store.users,
          getUserById: userById,
          updateUser: (id: string, updates: any) => set(userById(id), updates),
          deactivateUser: (targetId: string) => {
            // Immutable update that preserves other references
            store.users(
              store.users().map(u => 
                u.id === targetId ? { ...u, active: false } : u
              )
            );
          },
        };
      }
    );

    const store = createStore(Store, {
      users: [
        { id: '1', name: 'Alice', active: true },
        { id: '2', name: 'Bob', active: true },
      ],
    });

    // Cache user 2
    const user2 = store.getUserById('2');
    expect(user2.value?.name).toBe('Bob');

    // Deactivate user 1 (should preserve user 2's reference)
    store.deactivateUser('1');

    // User 2 lookup should still be O(1) from cache
    const user2Again = store.getUserById('2');
    expect(user2Again.value).toBe(user2.value); // Same reference preserved!
  });

  it('should clear cache when references change', () => {
    interface State {
      items: string[];
    }

    const Store = createComponent(
      withState<State>(),
      ({ store, select }) => {
        const itemAt = select((index: number) => {
          const items = store.items();
          return items[index];
        });

        return {
          items: store.items,
          getItemAt: itemAt,
          replaceItems: (newItems: string[]) => store.items(newItems),
        };
      }
    );

    const store = createStore(Store, {
      items: ['a', 'b', 'c'],
    });

    // This won't cache because strings are primitives
    const item = store.getItemAt(1);
    expect(item.value).toBe('b');

    // Replace array entirely
    store.replaceItems(['x', 'y', 'z']);
    
    // Should get new value
    const newItem = store.getItemAt(1);
    expect(newItem.value).toBe('y');
  });
});
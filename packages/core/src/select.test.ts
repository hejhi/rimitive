import { describe, it, expect } from 'vitest';
import { createComponent, withState, createStore } from './component';

describe('Select API with Computed Indexes', () => {
  it('should demonstrate O(1) lookups using computed indexes', () => {
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
      ({ store, select, computed, set }) => {
        // Build reactive indexes using computed - O(n) once, then cached
        const usersById = computed(() =>
          new Map(store.users().map(user => [user.id, user]))
        );
        
        const usersByEmail = computed(() =>
          new Map(store.users().map(user => [user.email, user]))
        );
        
        // Create selectors that use the indexes - always O(1)!
        const userById = select((id: string) => 
          usersById().get(id)
        );
        
        const userByEmail = select((email: string) =>
          usersByEmail().get(email)
        );

        return {
          users: store.users,
          userById,
          userByEmail,
          updateUser: (id: string, updates: Partial<User>) => {
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

    // All lookups are O(1) from the Map
    const user1 = store.userById('1');
    expect(user1.value).toEqual({
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
    });

    // Different selector, but still O(1) from its own index
    const user1ByEmail = store.userByEmail('alice@example.com');
    expect(user1ByEmail.value).toBe(user1.value); // Same reference!

    // Update via ID selector
    store.updateUser('1', { age: 26 });
    expect(store.users()[0]?.age).toBe(26);

    // Update via email selector
    store.updateUserByEmail('alice@example.com', { name: 'Alice Smith' });
    expect(store.users()[0]?.name).toBe('Alice Smith');
  });

  it('should maintain O(1) lookups after array updates', () => {
    interface State {
      users: Array<{ id: string; name: string; active: boolean }>;
    }

    const Store = createComponent(
      withState<State>(),
      ({ store, select, computed, set }) => {
        // Index rebuilds automatically when users array changes
        const usersById = computed(() =>
          new Map(store.users().map(u => [u.id, u]))
        );

        const userById = select((id: string) => usersById().get(id));

        return {
          users: store.users,
          getUserById: userById,
          updateUser: (id: string, updates: any) => set(userById(id), updates),
          addUser: (user: any) => {
            store.users([...store.users(), user]);
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

    // Initial lookup - O(1) from Map
    const user2 = store.getUserById('2');
    expect(user2.value?.name).toBe('Bob');

    // Add new user - index rebuilds
    store.addUser({ id: '3', name: 'Charlie', active: false });

    // Old user still accessible - O(1) from rebuilt index
    const user2Again = store.getUserById('2');
    expect(user2Again.value?.name).toBe('Bob');

    // New user also accessible - O(1)
    const user3 = store.getUserById('3');
    expect(user3.value?.name).toBe('Charlie');
  });

  it('should support multiple index types for different access patterns', () => {
    interface User {
      id: string;
      name: string;
      role: string;
      companyId: string;
      departmentId: string;
    }

    interface State {
      users: User[];
    }

    const Store = createComponent(
      withState<State>(),
      ({ store, select, computed }) => {
        // Single-value index for unique lookups
        const usersById = computed(() =>
          new Map(store.users().map(u => [u.id, u]))
        );

        // Multi-value index for one-to-many relationships  
        const usersByRole = computed(() => {
          const map = new Map<string, User[]>();
          for (const user of store.users()) {
            const list = map.get(user.role) || [];
            list.push(user);
            map.set(user.role, list);
          }
          return map;
        });

        // Compound key index
        const usersByCompoundKey = computed(() =>
          new Map(store.users().map(u => 
            [`${u.companyId}-${u.departmentId}`, u]
          ))
        );

        // Set index for existence checks
        const userIdSet = computed(() =>
          new Set(store.users().map(u => u.id))
        );

        return {
          // All lookups are O(1)!
          getUserById: select((id: string) => usersById().get(id)),
          getUsersByRole: select((role: string) => usersByRole().get(role) || []),
          getUserByCompoundKey: select((companyId: string, deptId: string) =>
            usersByCompoundKey().get(`${companyId}-${deptId}`)
          ),
          hasUser: select((id: string) => userIdSet().has(id)),
        };
      }
    );

    const store = createStore(Store, {
      users: [
        { id: '1', name: 'Alice', role: 'admin', companyId: 'acme', departmentId: 'eng' },
        { id: '2', name: 'Bob', role: 'user', companyId: 'acme', departmentId: 'sales' },
        { id: '3', name: 'Charlie', role: 'admin', companyId: 'globex', departmentId: 'eng' },
      ],
    });

    // Single value lookup - O(1)
    expect(store.getUserById('1').value?.name).toBe('Alice');

    // Multi-value lookup - O(1)  
    const admins = store.getUsersByRole('admin').value;
    expect(admins).toHaveLength(2);
    expect(admins?.[0]?.name).toBe('Alice');
    expect(admins?.[1]?.name).toBe('Charlie');

    // Compound key lookup - O(1)
    const engUser = store.getUserByCompoundKey('acme', 'eng').value;
    expect(engUser?.name).toBe('Alice');

    // Existence check - O(1)
    expect(store.hasUser('1').value).toBe(true);
    expect(store.hasUser('999').value).toBe(false);
  });

  it('should compose with other reactive primitives', () => {
    interface State {
      users: User[];
      currentUserId: string;
    }

    interface User {
      id: string;
      name: string;
      role: string;
    }

    const UserDashboard = createComponent(
      withState<State>(),
      ({ store, select, computed, set }) => {
        // Create index
        const usersById = computed(() =>
          new Map(store.users().map(u => [u.id, u]))
        );
        
        const userById = select((id: string) => usersById().get(id));

        return {
          userById,
          
          // Reactive current user - auto-updates when users OR currentUserId change
          currentUser: computed(() => 
            usersById().get(store.currentUserId())
          ),
          
          // Derived values stay reactive
          currentUserName: computed(() => 
            usersById().get(store.currentUserId())?.name || 'Anonymous'
          ),
          
          isCurrentUserAdmin: computed(() => 
            usersById().get(store.currentUserId())?.role === 'admin'
          ),
          
          // Updates work seamlessly
          promoteCurrentUser: () => {
            const userId = store.currentUserId();
            set(userById(userId), { role: 'admin' });
          },
          
          setCurrentUserId: (id: string) => set({ currentUserId: id }),
        };
      }
    );

    const store = createStore(UserDashboard, {
      users: [
        { id: '1', name: 'Alice', role: 'user' },
        { id: '2', name: 'Bob', role: 'admin' },
      ],
      currentUserId: '1',
    });

    // Everything stays reactive!
    expect(store.currentUserName()).toBe('Alice');
    expect(store.isCurrentUserAdmin()).toBe(false);

    // Change current user
    store.setCurrentUserId('2');
    expect(store.currentUserName()).toBe('Bob');
    expect(store.isCurrentUserAdmin()).toBe(true);

    // Promote user
    store.setCurrentUserId('1');
    store.promoteCurrentUser();
    expect(store.isCurrentUserAdmin()).toBe(true);
  });
});
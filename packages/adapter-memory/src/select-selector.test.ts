import { describe, it, expect } from 'vitest';
import { createComponent, createModel, createSlice, select } from '@lattice/core';
import { createMemoryAdapter } from './index';

describe('select() with selector', () => {
  describe('basic selector usage', () => {
    it('should select a single property from a slice', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { name: string; email: string };
          theme: 'light' | 'dark';
          setTheme: (theme: 'light' | 'dark') => void;
          setUser: (user: { name: string; email: string }) => void;
        }>(({ set }) => ({
          user: { name: 'John', email: 'john@example.com' },
          theme: 'light' as 'light' | 'dark',
          setTheme: (theme: 'light' | 'dark') => set({ theme }),
          setUser: (user: { name: string; email: string }) => set({ user })
        }));

        const userSlice = createSlice(model, (m) => ({
          user: m.user,
          theme: m.theme
        }));

        const headerSlice = createSlice(model, () => ({
          userName: select(userSlice, (s) => s.user.name),
          userEmail: select(userSlice, (s) => s.user.email)
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { userSlice, headerSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const state = result.views.headerSlice.get();

      expect(state.userName).toBe('John');
      expect(state.userEmail).toBe('john@example.com');
    });

    it('should select methods from action slices', () => {
      const component = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          reset: () => void;
        }>(({ get, set }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          reset: () => set({ count: 0 })
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
          reset: m.reset
        }));

        // Create button slices that select specific actions
        const incrementButton = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          disabled: m.count >= 10,
          label: 'Increment'
        }));

        const decrementButton = createSlice(model, () => ({
          onClick: select(actions, (a) => a.decrement),
          label: 'Decrement'
        }));

        return {
          model,
          actions,
          views: { incrementButton, decrementButton }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Test increment button
      const incButton = result.views.incrementButton.get();
      expect(incButton.label).toBe('Increment');
      expect(incButton.disabled).toBe(false);
      
      incButton.onClick();
      expect(result.model.get().count).toBe(1);

      // Test decrement button
      const decButton = result.views.decrementButton.get();
      decButton.onClick();
      expect(result.model.get().count).toBe(0);
    });
  });

  describe('complex selectors with computation', () => {
    it('should support complex transformations in selectors', () => {
      const component = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; completed: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [
            { id: 1, text: 'Learn Lattice', completed: true },
            { id: 2, text: 'Build app', completed: false },
            { id: 3, text: 'Deploy', completed: false }
          ],
          filter: 'all' as 'all' | 'active' | 'completed',
          addTodo: (text: string) => set({ 
            todos: [...get().todos, { id: Date.now(), text, completed: false }] 
          }),
          toggleTodo: (id: number) => set({
            todos: get().todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
          }),
          setFilter: (filter: 'all' | 'active' | 'completed') => set({ filter })
        }));

        const todoSlice = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter
        }));

        // Complex selector that filters and counts
        const statsSlice = createSlice(model, () => ({
          activeCount: select(todoSlice, (s) => 
            s.todos.filter(t => !t.completed).length
          ),
          completedCount: select(todoSlice, (s) => 
            s.todos.filter(t => t.completed).length
          ),
          filteredTodos: select(todoSlice, (s) => {
            switch (s.filter) {
              case 'active':
                return s.todos.filter(t => !t.completed);
              case 'completed':
                return s.todos.filter(t => t.completed);
              default:
                return s.todos;
            }
          })
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { todoSlice, statsSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const stats = result.views.statsSlice.get();

      expect(stats.activeCount).toBe(2);
      expect(stats.completedCount).toBe(1);
      expect(stats.filteredTodos).toHaveLength(3);
    });

    it('should support object transformation in selectors', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: {
            firstName: string;
            lastName: string;
            preferences: {
              theme: 'light' | 'dark';
              language: string;
            };
          };
          setUserName: (firstName: string, lastName: string) => void;
          setTheme: (theme: 'light' | 'dark') => void;
        }>(({ set, get }) => ({
          user: {
            firstName: 'Jane',
            lastName: 'Doe',
            preferences: {
              theme: 'dark' as 'light' | 'dark',
              language: 'en'
            }
          },
          setUserName: (firstName: string, lastName: string) => set({
            user: { ...get().user, firstName, lastName }
          }),
          setTheme: (theme: 'light' | 'dark') => set({
            user: { 
              ...get().user, 
              preferences: { ...get().user.preferences, theme } 
            }
          })
        }));

        const userSlice = createSlice(model, (m) => ({
          user: m.user
        }));

        // Transform user data for display
        const profileSlice = createSlice(model, () => ({
          displayName: select(userSlice, (s) => 
            `${s.user.firstName} ${s.user.lastName}`
          ),
          theme: select(userSlice, (s) => s.user.preferences.theme),
          initials: select(userSlice, (s) => 
            `${s.user.firstName[0]}${s.user.lastName[0]}`.toUpperCase()
          )
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { userSlice, profileSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const profile = result.views.profileSlice.get();

      expect(profile.displayName).toBe('Jane Doe');
      expect(profile.theme).toBe('dark');
      expect(profile.initials).toBe('JD');
    });
  });

  describe('nested select() usage', () => {
    it('should support selecting from already composed slices', () => {
      const component = createComponent(() => {
        const model = createModel<{
          auth: { isLoggedIn: boolean; userId: string | null };
          permissions: string[];
          login: (userId: string) => void;
          logout: () => void;
        }>(({ set }) => ({
          auth: { isLoggedIn: false, userId: null },
          permissions: [],
          login: (userId: string) => set({ 
            auth: { isLoggedIn: true, userId },
            permissions: ['read', 'write']
          }),
          logout: () => set({ 
            auth: { isLoggedIn: false, userId: null },
            permissions: []
          })
        }));

        const authSlice = createSlice(model, (m) => ({
          isLoggedIn: m.auth.isLoggedIn,
          userId: m.auth.userId,
          permissions: m.permissions
        }));

        const authActions = createSlice(model, (m) => ({
          login: m.login,
          logout: m.logout
        }));

        // Compose from authSlice
        const userMenuSlice = createSlice(model, () => ({
          visible: select(authSlice, (s) => s.isLoggedIn),
          userId: select(authSlice, (s) => s.userId),
          canWrite: select(authSlice, (s) => s.permissions.includes('write')),
          onLogout: select(authActions, (a) => a.logout)
        }));

        return {
          model,
          actions: authActions,
          views: { authSlice, userMenuSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Initially logged out
      let menu = result.views.userMenuSlice.get();
      expect(menu.visible).toBe(false);
      expect(menu.userId).toBe(null);
      expect(menu.canWrite).toBe(false);

      // Login
      result.actions.get().login('user123');

      // Check updated state
      menu = result.views.userMenuSlice.get();
      expect(menu.visible).toBe(true);
      expect(menu.userId).toBe('user123');
      expect(menu.canWrite).toBe(true);

      // Logout
      menu.onLogout();
      menu = result.views.userMenuSlice.get();
      expect(menu.visible).toBe(false);
    });

    it('should support multi-level composition', () => {
      const component = createComponent(() => {
        const model = createModel<{
          cart: { items: Array<{ id: string; price: number; quantity: number }> };
          shipping: { method: 'standard' | 'express'; cost: number };
          tax: { rate: number };
        }>(() => ({
          cart: {
            items: [
              { id: 'A', price: 10, quantity: 2 },
              { id: 'B', price: 15, quantity: 1 }
            ]
          },
          shipping: { method: 'standard', cost: 5 },
          tax: { rate: 0.08 }
        }));

        // Level 1: Basic slices
        const cartSlice = createSlice(model, (m) => ({
          items: m.cart.items
        }));

        const shippingSlice = createSlice(model, (m) => ({
          method: m.shipping.method,
          cost: m.shipping.cost
        }));

        const taxSlice = createSlice(model, (m) => ({
          rate: m.tax.rate
        }));

        // Level 2: Computed values
        const totalsSlice = createSlice(model, () => ({
          subtotal: select(cartSlice, (s) => 
            s.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          ),
          shipping: select(shippingSlice, (s) => s.cost),
          taxRate: select(taxSlice, (s) => s.rate)
        }));

        // Level 3: Final calculations
        const checkoutSlice = createSlice(model, () => ({
          subtotal: select(totalsSlice, (t) => t.subtotal),
          shipping: select(totalsSlice, (t) => t.shipping),
          tax: select(totalsSlice, (t) => t.subtotal * t.taxRate),
          total: select(totalsSlice, (t) => 
            t.subtotal + t.shipping + (t.subtotal * t.taxRate)
          )
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { cartSlice, shippingSlice, taxSlice, totalsSlice, checkoutSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const checkout = result.views.checkoutSlice.get();
      
      expect(checkout.subtotal).toBe(35); // (10*2) + (15*1)
      expect(checkout.shipping).toBe(5);
      expect(checkout.tax).toBeCloseTo(2.8, 10); // 35 * 0.08
      expect(checkout.total).toBeCloseTo(42.8, 10); // 35 + 5 + 2.8
    });
  });

  describe('real-world patterns', () => {
    it('should handle form with validation', () => {
      const component = createComponent(() => {
        const model = createModel<{
          form: {
            email: string;
            password: string;
            confirmPassword: string;
          };
          submitting: boolean;
          errors: string[];
          updateEmail: (email: string) => void;
          updatePassword: (password: string) => void;
          updateConfirmPassword: (password: string) => void;
          submit: () => Promise<void>;
        }>(({ get, set }) => ({
          form: { email: '', password: '', confirmPassword: '' },
          submitting: false,
          errors: [],
          updateEmail: (email: string) => 
            set({ form: { ...get().form, email } }),
          updatePassword: (password: string) => 
            set({ form: { ...get().form, password } }),
          updateConfirmPassword: (confirmPassword: string) => 
            set({ form: { ...get().form, confirmPassword } }),
          submit: async () => {
            set({ submitting: true, errors: [] });
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 100));
            set({ submitting: false });
          }
        }));

        const formSlice = createSlice(model, (m) => ({
          form: m.form,
          submitting: m.submitting
        }));

        const formActions = createSlice(model, (m) => ({
          updateEmail: m.updateEmail,
          updatePassword: m.updatePassword,
          updateConfirmPassword: m.updateConfirmPassword,
          submit: m.submit
        }));

        // Validation slice
        const validationSlice = createSlice(model, () => ({
          emailValid: select(formSlice, (s) => 
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.form.email)
          ),
          passwordValid: select(formSlice, (s) => 
            s.form.password.length >= 8
          ),
          passwordsMatch: select(formSlice, (s) => 
            s.form.password === s.form.confirmPassword && s.form.password !== ''
          ),
          canSubmit: select(formSlice, (s) => {
            const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.form.email);
            const passwordValid = s.form.password.length >= 8;
            const passwordsMatch = s.form.password === s.form.confirmPassword;
            return emailValid && passwordValid && passwordsMatch && !s.submitting;
          })
        }));

        // UI elements
        const submitButton = createSlice(model, () => ({
          onClick: select(formActions, (a) => a.submit),
          disabled: select(validationSlice, (v) => !v.canSubmit),
          text: select(formSlice, (s) => s.submitting ? 'Submitting...' : 'Submit')
        }));

        return {
          model,
          actions: formActions,
          views: { formSlice, validationSlice, submitButton }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Initial state
      let button = result.views.submitButton.get();
      expect(button.disabled).toBe(true);
      expect(button.text).toBe('Submit');

      // Fill form
      const actions = result.actions.get();
      actions.updateEmail('user@example.com');
      actions.updatePassword('password123');
      actions.updateConfirmPassword('password123');

      // Check validation
      const validation = result.views.validationSlice.get();
      expect(validation.emailValid).toBe(true);
      expect(validation.passwordValid).toBe(true);
      expect(validation.passwordsMatch).toBe(true);
      expect(validation.canSubmit).toBe(true);

      // Button should be enabled
      button = result.views.submitButton.get();
      expect(button.disabled).toBe(false);
    });

    it('should handle data table with sorting and filtering', () => {
      type User = { id: number; name: string; role: string; active: boolean };

      const component = createComponent(() => {
        const model = createModel<{
          users: User[];
          sortBy: 'name' | 'role' | null;
          sortOrder: 'asc' | 'desc';
          filterRole: string | null;
          showActiveOnly: boolean;
          setSortBy: (sortBy: 'name' | 'role' | null) => void;
          setSortOrder: (order: 'asc' | 'desc') => void;
          setFilterRole: (role: string | null) => void;
          setShowActiveOnly: (show: boolean) => void;
        }>(({ set }) => ({
          users: [
            { id: 1, name: 'Alice', role: 'admin', active: true },
            { id: 2, name: 'Bob', role: 'user', active: false },
            { id: 3, name: 'Charlie', role: 'admin', active: true },
            { id: 4, name: 'David', role: 'user', active: true }
          ],
          sortBy: null,
          sortOrder: 'asc',
          filterRole: null,
          showActiveOnly: false,
          setSortBy: (sortBy: 'name' | 'role' | null) => set({ sortBy }),
          setSortOrder: (sortOrder: 'asc' | 'desc') => set({ sortOrder }),
          setFilterRole: (filterRole: string | null) => set({ filterRole }),
          setShowActiveOnly: (showActiveOnly: boolean) => set({ showActiveOnly })
        }));

        const tableSlice = createSlice(model, (m) => ({
          users: m.users,
          sortBy: m.sortBy,
          sortOrder: m.sortOrder,
          filterRole: m.filterRole,
          showActiveOnly: m.showActiveOnly
        }));

        // Processed data slice
        const processedDataSlice = createSlice(model, () => ({
          filteredUsers: select(tableSlice, (s) => {
            let filtered = [...s.users];
            
            if (s.filterRole) {
              filtered = filtered.filter(u => u.role === s.filterRole);
            }
            
            if (s.showActiveOnly) {
              filtered = filtered.filter((u: User) => u.active);
            }
            
            if (s.sortBy) {
              const sortKey = s.sortBy;
              filtered.sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return s.sortOrder === 'asc' ? cmp : -cmp;
              });
            }
            
            return filtered;
          }),
          activeCount: select(tableSlice, (s) => 
            s.users.filter((u: User) => u.active).length
          ),
          roleBreakdown: select(tableSlice, (s) => {
            const breakdown: Record<string, number> = {};
            s.users.forEach((u: User) => {
              breakdown[u.role] = (breakdown[u.role] || 0) + 1;
            });
            return breakdown;
          })
        }));

        const actions = createSlice(model, (m) => ({
          setFilterRole: m.setFilterRole,
          setShowActiveOnly: m.setShowActiveOnly,
          setSortBy: m.setSortBy,
          setSortOrder: m.setSortOrder
        }));

        return {
          model,
          actions,
          views: { tableSlice, processedDataSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Initial data
      let data = result.views.processedDataSlice.get();
      expect(data.filteredUsers).toHaveLength(4);
      expect(data.activeCount).toBe(3);
      expect(data.roleBreakdown).toEqual({ admin: 2, user: 2 });

      // Apply filters
      const actions = result.actions.get();
      actions.setFilterRole('admin');
      actions.setShowActiveOnly(true);
      
      data = result.views.processedDataSlice.get();
      expect(data.filteredUsers).toHaveLength(2);
      expect(data.filteredUsers.every(u => u.role === 'admin' && u.active)).toBe(true);

      // Apply sorting
      actions.setSortBy('name');
      actions.setSortOrder('desc');
      
      data = result.views.processedDataSlice.get();
      expect(data.filteredUsers[0]?.name).toBe('Charlie');
      expect(data.filteredUsers[1]?.name).toBe('Alice');
    });
  });

  describe('type safety', () => {
    it('should preserve types through selector transformations', () => {
      const component = createComponent(() => {
        const model = createModel<{
          numbers: number[];
          config: { maxValue: number; minValue: number };
          setNumbers: (numbers: number[]) => void;
          setConfig: (config: { maxValue: number; minValue: number }) => void;
        }>(({ set }) => ({
          numbers: [1, 2, 3, 4, 5],
          config: { maxValue: 100, minValue: 0 },
          setNumbers: (numbers: number[]) => set({ numbers }),
          setConfig: (config: { maxValue: number; minValue: number }) => set({ config })
        }));

        const dataSlice = createSlice(model, (m) => ({
          numbers: m.numbers,
          config: m.config
        }));

        const statsSlice = createSlice(model, () => ({
          // Type is inferred as number
          sum: select(dataSlice, (s) => 
            s.numbers.reduce((a, b) => a + b, 0)
          ),
          // Type is inferred as number
          average: select(dataSlice, (s) => 
            s.numbers.reduce((a, b) => a + b, 0) / s.numbers.length
          ),
          // Type is inferred as boolean
          withinBounds: select(dataSlice, (s) => {
            const sum = s.numbers.reduce((a, b) => a + b, 0);
            return sum >= s.config.minValue && sum <= s.config.maxValue;
          }),
          // Type is inferred as string
          summary: select(dataSlice, (s) => 
            `Sum: ${s.numbers.reduce((a, b) => a + b, 0)}`
          )
        }));

        return {
          model,
          actions: createSlice(model, () => ({})),
          views: { dataSlice, statsSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const stats = result.views.statsSlice.get();

      // TypeScript knows these types
      const sum: number = stats.sum;
      const average: number = stats.average;
      const withinBounds: boolean = stats.withinBounds;
      const summary: string = stats.summary;

      expect(sum).toBe(15);
      expect(average).toBe(3);
      expect(withinBounds).toBe(true);
      expect(summary).toBe('Sum: 15');
    });

    it('should enforce type constraints in selectors', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: { value: number };
          updateValue: (n: number) => void;
        }>(({ set }) => ({
          data: { value: 42 },
          updateValue: (n: number) => set({ data: { value: n } })
        }));

        const dataSlice = createSlice(model, (m) => ({
          value: m.data.value
        }));

        const actions = createSlice(model, (m) => ({
          updateValue: m.updateValue
        }));

        // This should compile - selecting a method that matches the type
        const validSlice = createSlice(model, () => ({
          setValue: select(actions, (a) => a.updateValue),
          currentValue: select(dataSlice, (d) => d.value)
        }));

        return {
          model,
          actions,
          views: { dataSlice, validSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);
      const slice = result.views.validSlice.get();
      
      expect(slice.currentValue).toBe(42);
      
      slice.setValue(100);
      expect(result.views.dataSlice.get().value).toBe(100);
    });
  });
});
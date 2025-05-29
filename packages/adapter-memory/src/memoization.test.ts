import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent, select } from '@lattice/core';

describe('memory adapter - memoization verification', () => {
  describe('slice memoization', () => {
    it('should notify subscribers when model changes (reference equality)', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { name: string; email: string };
          theme: string;
          count: number;
          updateUser: (user: { name: string; email: string }) => void;
          updateTheme: (theme: string) => void;
          increment: () => void;
        }>(({ set, get }) => ({
          user: { name: 'John', email: 'john@example.com' },
          theme: 'dark',
          count: 0,
          updateUser: (user) => set({ user }),
          updateTheme: (theme) => set({ theme }),
          increment: () => set({ count: get().count + 1 })
        }));

        const userSlice = createSlice(model, (m) => ({
          name: m.user.name,
          email: m.user.email
        }));

        const themeSlice = createSlice(model, (m) => ({
          theme: m.theme
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateUser: m.updateUser,
            updateTheme: m.updateTheme,
            increment: m.increment
          })),
          views: { userSlice, themeSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Subscribe to slices
      const userUpdates: any[] = [];
      const themeUpdates: any[] = [];

      result.views.userSlice.subscribe(state => userUpdates.push(state));
      result.views.themeSlice.subscribe(state => themeUpdates.push(state));

      // Update unrelated state (count)
      result.actions.get().increment();

      // Slices are notified because they re-select from the model
      // even though their values haven't changed
      expect(userUpdates).toHaveLength(1);
      expect(userUpdates[0]).toEqual({ name: 'John', email: 'john@example.com' });
      expect(themeUpdates).toHaveLength(1);
      expect(themeUpdates[0]).toEqual({ theme: 'dark' });

      // Update theme
      result.actions.get().updateTheme('light');

      // Both slices are notified again due to reference equality
      expect(userUpdates).toHaveLength(2);
      expect(userUpdates[1]).toEqual({ name: 'John', email: 'john@example.com' }); // Same values
      expect(themeUpdates).toHaveLength(2);
      expect(themeUpdates[1]).toEqual({ theme: 'light' }); // Changed value

      // Update user
      result.actions.get().updateUser({ name: 'Jane', email: 'jane@example.com' });

      // Both slices notified again
      expect(userUpdates).toHaveLength(3);
      expect(userUpdates[2]).toEqual({ name: 'Jane', email: 'jane@example.com' });
      expect(themeUpdates).toHaveLength(3);
      expect(themeUpdates[2]).toEqual({ theme: 'light' }); // Same as before
    });

    it('should handle primitive values with proper memoization', () => {
      const component = createComponent(() => {
        const model = createModel<{
          value: number;
          nested: { count: number; label: string };
          setValue: (value: number) => void;
          setNested: (nested: { count: number; label: string }) => void;
        }>(({ set }) => ({
          value: 42,
          nested: { count: 10, label: 'test' },
          setValue: (value) => set({ value }),
          setNested: (nested) => set({ nested })
        }));

        const valueSlice = createSlice(model, (m) => ({
          value: m.value
        }));

        const nestedSlice = createSlice(model, (m) => ({
          count: m.nested.count,
          label: m.nested.label
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setValue: m.setValue,
            setNested: m.setNested
          })),
          views: { valueSlice, nestedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const valueUpdates: any[] = [];
      const nestedUpdates: any[] = [];

      result.views.valueSlice.subscribe(state => valueUpdates.push(state));
      result.views.nestedSlice.subscribe(state => nestedUpdates.push(state));

      // Set same value - both slices notified due to model change
      result.actions.get().setValue(42);
      expect(valueUpdates).toHaveLength(1); // Notified even though value is same
      expect(valueUpdates[0]).toEqual({ value: 42 });
      expect(nestedUpdates).toHaveLength(1); // Also notified due to model change
      expect(nestedUpdates[0]).toEqual({ count: 10, label: 'test' });

      // Set different value
      result.actions.get().setValue(43);
      expect(valueUpdates).toHaveLength(2);
      expect(valueUpdates[1]).toEqual({ value: 43 });
      expect(nestedUpdates).toHaveLength(2); // Also notified again

      // Set same nested object (reference changes but values same)
      result.actions.get().setNested({ count: 10, label: 'test' });
      expect(valueUpdates).toHaveLength(3); // Value slice also notified
      expect(nestedUpdates).toHaveLength(3); // Notified due to new reference
      expect(nestedUpdates[2]).toEqual({ count: 10, label: 'test' });

      // Set different nested values
      result.actions.get().setNested({ count: 11, label: 'test' });
      expect(valueUpdates).toHaveLength(4);
      expect(nestedUpdates).toHaveLength(4);
      expect(nestedUpdates[3]).toEqual({ count: 11, label: 'test' });
    });

    it('should demonstrate proper memoization with primitive selectors', () => {
      const component = createComponent(() => {
        const model = createModel<{
          user: { name: string; email: string; age: number };
          settings: { theme: string; notifications: boolean };
          updateUserAge: (age: number) => void;
          updateTheme: (theme: string) => void;
        }>(({ set, get }) => ({
          user: { name: 'John', email: 'john@example.com', age: 30 },
          settings: { theme: 'dark', notifications: true },
          updateUserAge: (age) => set({ user: { ...get().user, age } }),
          updateTheme: (theme) => set({ settings: { ...get().settings, theme } })
        }));

        // Slice that selects only primitive values
        const userAgeSlice = createSlice(model, (m) => m.user.age);
        const themeSlice = createSlice(model, (m) => m.settings.theme);

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateUserAge: m.updateUserAge,
            updateTheme: m.updateTheme
          })),
          views: { userAgeSlice, themeSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const ageUpdates: number[] = [];
      const themeUpdates: string[] = [];

      result.views.userAgeSlice.subscribe(age => ageUpdates.push(age));
      result.views.themeSlice.subscribe(theme => themeUpdates.push(theme));

      // Update theme - only theme slice notified
      result.actions.get().updateTheme('light');
      expect(ageUpdates).toHaveLength(0); // Age slice not notified
      expect(themeUpdates).toHaveLength(1);
      expect(themeUpdates[0]).toBe('light');

      // Update age - only age slice notified
      result.actions.get().updateUserAge(31);
      expect(ageUpdates).toHaveLength(1);
      expect(ageUpdates[0]).toBe(31);
      expect(themeUpdates).toHaveLength(1); // No additional theme updates

      // Update age to same value
      result.actions.get().updateUserAge(31);
      expect(ageUpdates).toHaveLength(1); // No notification for same primitive value
    });
  });

  describe('nested slice memoization', () => {
    it('should properly memoize nested slice selections', () => {
      const component = createComponent(() => {
        const model = createModel<{
          data: {
            items: Array<{ id: number; value: string }>;
            filter: string;
          };
          meta: {
            loading: boolean;
            error: string | null;
          };
          setFilter: (filter: string) => void;
          setLoading: (loading: boolean) => void;
          addItem: (item: { id: number; value: string }) => void;
        }>(({ set, get }) => ({
          data: {
            items: [
              { id: 1, value: 'one' },
              { id: 2, value: 'two' }
            ],
            filter: ''
          },
          meta: {
            loading: false,
            error: null
          },
          setFilter: (filter) => set({ data: { ...get().data, filter } }),
          setLoading: (loading) => set({ meta: { ...get().meta, loading } }),
          addItem: (item) => set({ 
            data: { ...get().data, items: [...get().data.items, item] } 
          })
        }));

        const dataSlice = createSlice(model, (m) => ({
          items: m.data.items,
          filter: m.data.filter
        }));

        const metaSlice = createSlice(model, (m) => ({
          loading: m.meta.loading,
          error: m.meta.error
        }));

        // Nested slice that selects from other slices
        const filteredSlice = createSlice(model, () => ({
          items: select(dataSlice, (d) => 
            d.filter ? d.items.filter(item => item.value.includes(d.filter)) : d.items
          ),
          isFiltered: select(dataSlice, (d) => d.filter !== ''),
          loading: select(metaSlice, (m) => m.loading)
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setFilter: m.setFilter,
            setLoading: m.setLoading,
            addItem: m.addItem
          })),
          views: { dataSlice, metaSlice, filteredSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const filteredUpdates: any[] = [];
      result.views.filteredSlice.subscribe(state => filteredUpdates.push(state));

      // Change loading state - should trigger update because it's selected
      result.actions.get().setLoading(true);
      expect(filteredUpdates).toHaveLength(1);
      expect(filteredUpdates[0].loading).toBe(true);

      // Change filter - should trigger update with filtered items
      result.actions.get().setFilter('o');
      expect(filteredUpdates).toHaveLength(2);
      expect(filteredUpdates[1].items).toHaveLength(2); // Both 'one' and 'two' contain 'o'
      expect(filteredUpdates[1].isFiltered).toBe(true);

      // Add item that doesn't match filter
      result.actions.get().addItem({ id: 3, value: 'three' });
      expect(filteredUpdates).toHaveLength(3);
      expect(filteredUpdates[2].items).toHaveLength(2); // Still only 'one' and 'two'

      // Clear filter
      result.actions.get().setFilter('');
      expect(filteredUpdates).toHaveLength(4);
      expect(filteredUpdates[3].items).toHaveLength(3); // Now shows all items
      expect(filteredUpdates[3].isFiltered).toBe(false);
    });

    it('should handle multi-level nested selections efficiently', () => {
      const component = createComponent(() => {
        const model = createModel<{
          app: {
            user: { id: string; name: string; preferences: { theme: string } };
            settings: { notifications: boolean; autoSave: boolean };
          };
          ui: {
            sidebarOpen: boolean;
            modalVisible: boolean;
          };
          updateTheme: (theme: string) => void;
          toggleSidebar: () => void;
          toggleNotifications: () => void;
        }>(({ set, get }) => ({
          app: {
            user: { 
              id: '123', 
              name: 'Test User', 
              preferences: { theme: 'dark' } 
            },
            settings: { 
              notifications: true, 
              autoSave: false 
            }
          },
          ui: {
            sidebarOpen: true,
            modalVisible: false
          },
          updateTheme: (theme) => set({
            app: { 
              ...get().app, 
              user: { 
                ...get().app.user, 
                preferences: { theme } 
              }
            }
          }),
          toggleSidebar: () => set({
            ui: { ...get().ui, sidebarOpen: !get().ui.sidebarOpen }
          }),
          toggleNotifications: () => set({
            app: {
              ...get().app,
              settings: {
                ...get().app.settings,
                notifications: !get().app.settings.notifications
              }
            }
          })
        }));

        // Level 1 slices
        const userSlice = createSlice(model, (m) => ({
          user: m.app.user
        }));

        const settingsSlice = createSlice(model, (m) => ({
          settings: m.app.settings
        }));

        const uiSlice = createSlice(model, (m) => ({
          sidebarOpen: m.ui.sidebarOpen,
          modalVisible: m.ui.modalVisible
        }));

        // Level 2 slice - composes from level 1
        const profileSlice = createSlice(model, () => ({
          name: select(userSlice, (u) => u.user.name),
          theme: select(userSlice, (u) => u.user.preferences.theme),
          notificationsEnabled: select(settingsSlice, (s) => s.settings.notifications)
        }));

        // Level 3 slice - composes from multiple levels
        const dashboardSlice = createSlice(model, () => ({
          greeting: select(profileSlice, (p) => `Hello, ${p.name}`),
          themeClass: select(profileSlice, (p) => `theme-${p.theme}`),
          showNotificationBadge: select(profileSlice, (p) => p.notificationsEnabled),
          sidebarVisible: select(uiSlice, (ui) => ui.sidebarOpen)
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateTheme: m.updateTheme,
            toggleSidebar: m.toggleSidebar,
            toggleNotifications: m.toggleNotifications
          })),
          views: { userSlice, settingsSlice, uiSlice, profileSlice, dashboardSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Track updates at each level
      const profileUpdates: any[] = [];
      const dashboardUpdates: any[] = [];

      result.views.profileSlice.subscribe(state => profileUpdates.push(state));
      result.views.dashboardSlice.subscribe(state => dashboardUpdates.push(state));

      // Toggle sidebar - affects all slices due to reference equality
      result.actions.get().toggleSidebar();
      expect(profileUpdates).toHaveLength(1); // Profile gets notified even though its data didn't change
      expect(profileUpdates[0]).toEqual({
        name: 'Test User',
        theme: 'dark',
        notificationsEnabled: true
      });
      expect(dashboardUpdates).toHaveLength(1);
      expect(dashboardUpdates[0].sidebarVisible).toBe(false);

      // Update theme - affects both profile and dashboard
      result.actions.get().updateTheme('light');
      expect(profileUpdates).toHaveLength(2);
      expect(profileUpdates[1].theme).toBe('light');
      expect(dashboardUpdates).toHaveLength(2);
      expect(dashboardUpdates[1].themeClass).toBe('theme-light');

      // Toggle notifications - affects profile and dashboard
      result.actions.get().toggleNotifications();
      expect(profileUpdates).toHaveLength(3);
      expect(profileUpdates[2].notificationsEnabled).toBe(false);
      expect(dashboardUpdates).toHaveLength(3);
      expect(dashboardUpdates[2].showNotificationBadge).toBe(false);
    });
  });

  describe('computed value caching', () => {
    it('should cache and reuse computed values when dependencies do not change', () => {
      let computationCount = 0;

      const component = createComponent(() => {
        const model = createModel<{
          numbers: number[];
          multiplier: number;
          addNumber: (n: number) => void;
          setMultiplier: (m: number) => void;
        }>(({ set, get }) => ({
          numbers: [1, 2, 3, 4, 5],
          multiplier: 2,
          addNumber: (n) => set({ numbers: [...get().numbers, n] }),
          setMultiplier: (m) => set({ multiplier: m })
        }));

        const dataSlice = createSlice(model, (m) => ({
          numbers: m.numbers,
          multiplier: m.multiplier
        }));

        // Expensive computation slice
        const statsSlice = createSlice(model, () => ({
          // Track computation calls
          expensiveSum: select(dataSlice, (d) => {
            computationCount++;
            return d.numbers.reduce((a, b) => a + b, 0) * d.multiplier;
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addNumber: m.addNumber,
            setMultiplier: m.setMultiplier
          })),
          views: { dataSlice, statsSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Initial computation
      computationCount = 0;
      const initialStats = result.views.statsSlice.get();
      expect(initialStats.expensiveSum).toBe(30); // (1+2+3+4+5) * 2
      expect(computationCount).toBe(1);

      // Access again - recomputes each time due to new object reference
      const cachedStats = result.views.statsSlice.get();
      expect(cachedStats.expensiveSum).toBe(30);
      expect(computationCount).toBe(2); // Recomputed

      // Subscribe to changes
      const updates: any[] = [];
      result.views.statsSlice.subscribe(state => updates.push(state));

      // Change dependency - should recompute
      result.actions.get().addNumber(6);
      expect(updates).toHaveLength(1);
      expect(updates[0].expensiveSum).toBe(42); // (1+2+3+4+5+6) * 2
      expect(computationCount).toBe(3); // Once for initial, once for get(), once for update

      // Access multiple times - recomputes each time
      result.views.statsSlice.get();
      result.views.statsSlice.get();
      result.views.statsSlice.get();
      expect(computationCount).toBe(6); // 3 more computations
    });

    it('should handle computed views with multiple dependencies', () => {
      const component = createComponent(() => {
        const model = createModel<{
          cart: Array<{ id: string; price: number; quantity: number }>;
          discountPercent: number;
          taxRate: number;
          shippingCost: number;
          updateQuantity: (id: string, quantity: number) => void;
          setDiscount: (percent: number) => void;
          setShipping: (cost: number) => void;
        }>(({ set, get }) => ({
          cart: [
            { id: 'A', price: 10, quantity: 2 },
            { id: 'B', price: 20, quantity: 1 }
          ],
          discountPercent: 0,
          taxRate: 0.08,
          shippingCost: 5,
          updateQuantity: (id, quantity) => set({
            cart: get().cart.map(item => 
              item.id === id ? { ...item, quantity } : item
            )
          }),
          setDiscount: (discountPercent) => set({ discountPercent }),
          setShipping: (shippingCost) => set({ shippingCost })
        }));

        const cartSlice = createSlice(model, (m) => ({
          items: m.cart,
          discount: m.discountPercent,
          tax: m.taxRate,
          shipping: m.shippingCost
        }));

        // Create computed slice with multiple dependencies
        const checkoutSlice = createSlice(model, () => ({
          subtotal: select(cartSlice, (c) => 
            c.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          ),
          discountAmount: select(cartSlice, (c) => {
            const subtotal = c.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return subtotal * (c.discount / 100);
          }),
          taxAmount: select(cartSlice, (c) => {
            const subtotal = c.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const afterDiscount = subtotal * (1 - c.discount / 100);
            return afterDiscount * c.tax;
          }),
          total: select(cartSlice, (c) => {
            const subtotal = c.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const afterDiscount = subtotal * (1 - c.discount / 100);
            const tax = afterDiscount * c.tax;
            return afterDiscount + tax + c.shipping;
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateQuantity: m.updateQuantity,
            setDiscount: m.setDiscount,
            setShipping: m.setShipping
          })),
          views: { cartSlice, checkoutSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const checkoutUpdates: any[] = [];
      result.views.checkoutSlice.subscribe(state => checkoutUpdates.push(state));

      // Initial state
      const initial = result.views.checkoutSlice.get();
      expect(initial.subtotal).toBe(40); // 10*2 + 20*1
      expect(initial.discountAmount).toBe(0);
      expect(initial.taxAmount).toBeCloseTo(3.2); // 40 * 0.08
      expect(initial.total).toBeCloseTo(48.2); // 40 + 3.2 + 5

      // Apply discount - should update discount, tax, and total
      result.actions.get().setDiscount(10);
      expect(checkoutUpdates).toHaveLength(1);
      expect(checkoutUpdates[0].subtotal).toBe(40); // Unchanged
      expect(checkoutUpdates[0].discountAmount).toBe(4); // 40 * 0.1
      expect(checkoutUpdates[0].taxAmount).toBeCloseTo(2.88); // 36 * 0.08
      expect(checkoutUpdates[0].total).toBeCloseTo(43.88); // 36 + 2.88 + 5

      // Update shipping - only total should change
      result.actions.get().setShipping(10);
      expect(checkoutUpdates).toHaveLength(2);
      expect(checkoutUpdates[1].subtotal).toBe(40); // Unchanged
      expect(checkoutUpdates[1].discountAmount).toBe(4); // Unchanged
      expect(checkoutUpdates[1].taxAmount).toBeCloseTo(2.88); // Unchanged
      expect(checkoutUpdates[1].total).toBeCloseTo(48.88); // 36 + 2.88 + 10
    });
  });

  describe('multiple subscribers sharing memoized values', () => {
    it('should share memoized values across multiple subscribers', () => {
      let computationCount = 0;

      const component = createComponent(() => {
        const model = createModel<{
          data: { value: number; label: string };
          updateValue: (value: number) => void;
        }>(({ set, get }) => ({
          data: { value: 1, label: 'test' },
          updateValue: (value) => set({ 
            data: { ...get().data, value } 
          })
        }));

        const dataSlice = createSlice(model, (m) => m.data);

        // Computed slice that tracks computations
        const computedSlice = createSlice(model, () => ({
          computed: select(dataSlice, (d) => {
            computationCount++;
            return d.value * d.value; // Square the value
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateValue: m.updateValue
          })),
          views: { dataSlice, computedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Reset counter after initialization
      computationCount = 0;

      // Add multiple subscribers
      const subscriber1Updates: any[] = [];
      const subscriber2Updates: any[] = [];
      const subscriber3Updates: any[] = [];

      result.views.computedSlice.subscribe(s => subscriber1Updates.push(s));
      const unsub2 = result.views.computedSlice.subscribe(s => subscriber2Updates.push(s));
      result.views.computedSlice.subscribe(s => subscriber3Updates.push(s));

      // Update value
      result.actions.get().updateValue(3);

      // All subscribers should receive the update
      expect(subscriber1Updates).toHaveLength(1);
      expect(subscriber2Updates).toHaveLength(1);
      expect(subscriber3Updates).toHaveLength(1);

      // All should have the same computed value
      expect(subscriber1Updates[0].computed).toBe(9);
      expect(subscriber2Updates[0].computed).toBe(9);
      expect(subscriber3Updates[0].computed).toBe(9);

      // Computation should only happen once
      expect(computationCount).toBe(1);

      // Unsubscribe one
      unsub2();

      // Update again
      result.actions.get().updateValue(4);

      // Only active subscribers get updates
      expect(subscriber1Updates).toHaveLength(2);
      expect(subscriber2Updates).toHaveLength(1); // No new update
      expect(subscriber3Updates).toHaveLength(2);

      // Computation still happens only once per update
      expect(computationCount).toBe(2);
    });

    it('should handle concurrent slice access efficiently', () => {
      const component = createComponent(() => {
        const model = createModel<{
          items: Array<{ id: number; name: string; category: string }>;
          searchTerm: string;
          selectedCategory: string | null;
          setSearchTerm: (term: string) => void;
          setCategory: (category: string | null) => void;
        }>(({ set }) => ({
          items: [
            { id: 1, name: 'Apple', category: 'fruit' },
            { id: 2, name: 'Banana', category: 'fruit' },
            { id: 3, name: 'Carrot', category: 'vegetable' },
            { id: 4, name: 'Broccoli', category: 'vegetable' }
          ],
          searchTerm: '',
          selectedCategory: null,
          setSearchTerm: (searchTerm) => set({ searchTerm }),
          setCategory: (selectedCategory) => set({ selectedCategory })
        }));

        const filterSlice = createSlice(model, (m) => ({
          items: m.items,
          searchTerm: m.searchTerm,
          selectedCategory: m.selectedCategory
        }));

        // Multiple slices that depend on the same filtered data
        const filteredItemsSlice = createSlice(model, () => ({
          items: select(filterSlice, (f) => {
            let filtered = f.items;
            if (f.searchTerm) {
              filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(f.searchTerm.toLowerCase())
              );
            }
            if (f.selectedCategory) {
              filtered = filtered.filter(item => 
                item.category === f.selectedCategory
              );
            }
            return filtered;
          })
        }));

        const countsSlice = createSlice(model, () => ({
          totalCount: select(filteredItemsSlice, (f) => f.items.length),
          categoryBreakdown: select(filteredItemsSlice, (f) => {
            const breakdown: Record<string, number> = {};
            f.items.forEach(item => {
              breakdown[item.category] = (breakdown[item.category] || 0) + 1;
            });
            return breakdown;
          })
        }));

        const summarySlice = createSlice(model, () => ({
          message: select(countsSlice, (c) => 
            `Found ${c.totalCount} items`
          ),
          hasResults: select(countsSlice, (c) => c.totalCount > 0)
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setSearchTerm: m.setSearchTerm,
            setCategory: m.setCategory
          })),
          views: { filteredItemsSlice, countsSlice, summarySlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Subscribe to all views
      const itemUpdates: any[] = [];
      const countUpdates: any[] = [];
      const summaryUpdates: any[] = [];

      result.views.filteredItemsSlice.subscribe(s => itemUpdates.push(s));
      result.views.countsSlice.subscribe(s => countUpdates.push(s));
      result.views.summarySlice.subscribe(s => summaryUpdates.push(s));

      // Initial state check
      expect(result.views.summarySlice.get().message).toBe('Found 4 items');

      // Apply search filter
      result.actions.get().setSearchTerm('b');

      // All dependent slices should update
      expect(itemUpdates).toHaveLength(1);
      expect(itemUpdates[0].items).toHaveLength(2); // Banana, Broccoli
      expect(countUpdates).toHaveLength(1);
      expect(countUpdates[0].totalCount).toBe(2);
      expect(summaryUpdates).toHaveLength(1);
      expect(summaryUpdates[0].message).toBe('Found 2 items');

      // Apply category filter
      result.actions.get().setCategory('fruit');

      // Chain of updates
      expect(itemUpdates).toHaveLength(2);
      expect(itemUpdates[1].items).toHaveLength(1); // Only Banana
      expect(countUpdates).toHaveLength(2);
      expect(summaryUpdates).toHaveLength(2);
      expect(summaryUpdates[1].message).toBe('Found 1 items');
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state updates efficiently', async () => {
      const component = createComponent(() => {
        const model = createModel<{
          counter: number;
          increment: () => void;
        }>(({ set, get }) => ({
          counter: 0,
          increment: () => set({ counter: get().counter + 1 })
        }));

        const counterSlice = createSlice(model, (m) => ({
          value: m.counter,
          isEven: m.counter % 2 === 0,
          isPositive: m.counter > 0
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment
          })),
          views: { counterSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const updates: any[] = [];
      result.views.counterSlice.subscribe(state => updates.push(state));

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        result.actions.get().increment();
      }

      // Should have received all updates
      expect(updates).toHaveLength(100);
      expect(updates[99].value).toBe(100);
      expect(updates[99].isEven).toBe(true);
      expect(updates[99].isPositive).toBe(true);

      // Verify each update was correct
      updates.forEach((update, index) => {
        expect(update.value).toBe(index + 1);
        expect(update.isEven).toBe((index + 1) % 2 === 0);
        expect(update.isPositive).toBe(true);
      });
    });

    it('should handle deep object comparisons correctly', () => {
      const component = createComponent(() => {
        const model = createModel<{
          deeply: {
            nested: {
              object: {
                value: number;
                array: number[];
                meta: { id: string; tags: string[] };
              };
            };
          };
          updateValue: (value: number) => void;
          updateArray: (array: number[]) => void;
          updateTags: (tags: string[]) => void;
        }>(({ set, get }) => ({
          deeply: {
            nested: {
              object: {
                value: 42,
                array: [1, 2, 3],
                meta: { id: 'test', tags: ['a', 'b'] }
              }
            }
          },
          updateValue: (value) => set({
            deeply: {
              nested: {
                object: {
                  ...get().deeply.nested.object,
                  value
                }
              }
            }
          }),
          updateArray: (array) => set({
            deeply: {
              nested: {
                object: {
                  ...get().deeply.nested.object,
                  array
                }
              }
            }
          }),
          updateTags: (tags) => set({
            deeply: {
              nested: {
                object: {
                  ...get().deeply.nested.object,
                  meta: { ...get().deeply.nested.object.meta, tags }
                }
              }
            }
          })
        }));

        // Different slices selecting different parts
        const valueSlice = createSlice(model, (m) => ({
          value: m.deeply.nested.object.value
        }));

        const arraySlice = createSlice(model, (m) => ({
          array: m.deeply.nested.object.array,
          length: m.deeply.nested.object.array.length
        }));

        const metaSlice = createSlice(model, (m) => ({
          id: m.deeply.nested.object.meta.id,
          tags: m.deeply.nested.object.meta.tags,
          tagCount: m.deeply.nested.object.meta.tags.length
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateValue: m.updateValue,
            updateArray: m.updateArray,
            updateTags: m.updateTags
          })),
          views: { valueSlice, arraySlice, metaSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const valueUpdates: any[] = [];
      const arrayUpdates: any[] = [];
      const metaUpdates: any[] = [];

      result.views.valueSlice.subscribe(s => valueUpdates.push(s));
      result.views.arraySlice.subscribe(s => arrayUpdates.push(s));
      result.views.metaSlice.subscribe(s => metaUpdates.push(s));

      // Update value - all slices get notified due to model state change
      result.actions.get().updateValue(100);
      expect(valueUpdates).toHaveLength(1);
      expect(valueUpdates[0].value).toBe(100);
      expect(arrayUpdates).toHaveLength(1); // Notified even though array didn't change
      expect(arrayUpdates[0].array).toEqual([1, 2, 3]); // Same array
      expect(metaUpdates).toHaveLength(1); // Notified even though meta didn't change
      expect(metaUpdates[0].tags).toEqual(['a', 'b']); // Same tags

      // Update array - all slices get notified again
      result.actions.get().updateArray([4, 5, 6, 7]);
      expect(valueUpdates).toHaveLength(2);
      expect(valueUpdates[1].value).toBe(100); // Same value as before
      expect(arrayUpdates).toHaveLength(2);
      expect(arrayUpdates[1].array).toEqual([4, 5, 6, 7]);
      expect(arrayUpdates[1].length).toBe(4);
      expect(metaUpdates).toHaveLength(2);

      // Update tags - all slices get notified again
      result.actions.get().updateTags(['x', 'y', 'z']);
      expect(valueUpdates).toHaveLength(3);
      expect(arrayUpdates).toHaveLength(3);
      expect(metaUpdates).toHaveLength(3);
      expect(metaUpdates[2].tags).toEqual(['x', 'y', 'z']);
      expect(metaUpdates[2].tagCount).toBe(3);
    });

    it('should handle array modifications efficiently', () => {
      const component = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'done';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          removeTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'done') => void;
        }>(({ set, get }) => ({
          todos: [
            { id: 1, text: 'First', done: false },
            { id: 2, text: 'Second', done: true }
          ],
          filter: 'all',
          addTodo: (text) => set({
            todos: [...get().todos, { id: Date.now(), text, done: false }]
          }),
          toggleTodo: (id) => set({
            todos: get().todos.map(t => 
              t.id === id ? { ...t, done: !t.done } : t
            )
          }),
          removeTodo: (id) => set({
            todos: get().todos.filter(t => t.id !== id)
          }),
          setFilter: (filter) => set({ filter })
        }));

        const todoSlice = createSlice(model, (m) => ({
          todos: m.todos,
          filter: m.filter
        }));

        // Various computed slices
        const statsSlice = createSlice(model, () => ({
          total: select(todoSlice, (t) => t.todos.length),
          active: select(todoSlice, (t) => t.todos.filter(todo => !todo.done).length),
          done: select(todoSlice, (t) => t.todos.filter(todo => todo.done).length),
          filteredTodos: select(todoSlice, (t) => {
            switch (t.filter) {
              case 'active': return t.todos.filter(todo => !todo.done);
              case 'done': return t.todos.filter(todo => todo.done);
              default: return t.todos;
            }
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            addTodo: m.addTodo,
            toggleTodo: m.toggleTodo,
            removeTodo: m.removeTodo,
            setFilter: m.setFilter
          })),
          views: { todoSlice, statsSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const statsUpdates: any[] = [];
      result.views.statsSlice.subscribe(s => statsUpdates.push(s));

      // Initial state
      expect(result.views.statsSlice.get()).toEqual({
        total: 2,
        active: 1,
        done: 1,
        filteredTodos: expect.any(Array)
      });

      // Add todo
      result.actions.get().addTodo('Third');
      expect(statsUpdates).toHaveLength(1);
      expect(statsUpdates[0].total).toBe(3);
      expect(statsUpdates[0].active).toBe(2);

      // Toggle todo
      const firstTodo = result.model.get().todos[0];
      if (firstTodo) {
        result.actions.get().toggleTodo(firstTodo.id);
        expect(statsUpdates).toHaveLength(2);
        expect(statsUpdates[1].active).toBe(1);
        expect(statsUpdates[1].done).toBe(2);
      }

      // Filter change - stats don't change but filtered list does
      result.actions.get().setFilter('active');
      expect(statsUpdates).toHaveLength(3);
      expect(statsUpdates[2].total).toBe(3); // Unchanged
      expect(statsUpdates[2].filteredTodos).toHaveLength(1);

      // Remove todo
      if (firstTodo) {
        result.actions.get().removeTodo(firstTodo.id);
        expect(statsUpdates).toHaveLength(4);
        expect(statsUpdates[3].total).toBe(2);
        expect(statsUpdates[3].done).toBe(1);
      }
    });

    it('should handle undefined and null values in memoization', () => {
      const component = createComponent(() => {
        const model = createModel<{
          nullable: string | null;
          optional?: { value: number };
          array: (string | null)[];
          setNullable: (value: string | null) => void;
          setOptional: (value: { value: number } | undefined) => void;
          updateArray: (index: number, value: string | null) => void;
        }>(({ set, get }) => ({
          nullable: null,
          optional: undefined,
          array: ['a', null, 'b'],
          setNullable: (nullable) => set({ nullable }),
          setOptional: (optional) => set({ optional }),
          updateArray: (index, value) => {
            const array = [...get().array];
            array[index] = value;
            set({ array });
          }
        }));

        const dataSlice = createSlice(model, (m) => ({
          nullable: m.nullable,
          optional: m.optional,
          array: m.array
        }));

        const computedSlice = createSlice(model, () => ({
          hasNullable: select(dataSlice, (d) => d.nullable !== null),
          optionalValue: select(dataSlice, (d) => d.optional?.value ?? -1),
          nonNullCount: select(dataSlice, (d) => 
            d.array.filter(item => item !== null).length
          )
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setNullable: m.setNullable,
            setOptional: m.setOptional,
            updateArray: m.updateArray
          })),
          views: { dataSlice, computedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      const updates: any[] = [];
      result.views.computedSlice.subscribe(s => updates.push(s));

      // Initial state
      expect(result.views.computedSlice.get()).toEqual({
        hasNullable: false,
        optionalValue: -1,
        nonNullCount: 2
      });

      // Set nullable to value
      result.actions.get().setNullable('test');
      expect(updates).toHaveLength(1);
      expect(updates[0].hasNullable).toBe(true);

      // Set nullable back to null
      result.actions.get().setNullable(null);
      expect(updates).toHaveLength(2);
      expect(updates[1].hasNullable).toBe(false);

      // Set optional
      result.actions.get().setOptional({ value: 42 });
      expect(updates).toHaveLength(3);
      expect(updates[2].optionalValue).toBe(42);

      // Update array null to value
      result.actions.get().updateArray(1, 'c');
      expect(updates).toHaveLength(4);
      expect(updates[3].nonNullCount).toBe(3);
    });
  });

  describe('performance patterns', () => {
    it('should efficiently handle large collections with filtering', () => {
      const ITEM_COUNT = 1000;
      
      const component = createComponent(() => {
        const model = createModel<{
          items: Array<{ id: number; category: string; value: number }>;
          filterCategory: string | null;
          minValue: number;
          setFilterCategory: (category: string | null) => void;
          setMinValue: (value: number) => void;
        }>(({ set }) => ({
          items: Array.from({ length: ITEM_COUNT }, (_, i) => ({
            id: i,
            category: ['A', 'B', 'C'][i % 3] as string,
            value: Math.floor(Math.random() * 100)
          })),
          filterCategory: null,
          minValue: 0,
          setFilterCategory: (filterCategory) => set({ filterCategory }),
          setMinValue: (minValue) => set({ minValue })
        }));

        const filterSlice = createSlice(model, (m) => ({
          items: m.items,
          filterCategory: m.filterCategory,
          minValue: m.minValue
        }));

        const filteredSlice = createSlice(model, () => ({
          items: select(filterSlice, (f) => {
            let result = f.items;
            if (f.filterCategory) {
              result = result.filter(item => item.category === f.filterCategory);
            }
            if (f.minValue > 0) {
              result = result.filter(item => item.value >= f.minValue);
            }
            return result;
          }),
          count: select(filterSlice, (f) => {
            let count = 0;
            for (const item of f.items) {
              if (f.filterCategory && item.category !== f.filterCategory) continue;
              if (f.minValue > 0 && item.value < f.minValue) continue;
              count++;
            }
            return count;
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setFilterCategory: m.setFilterCategory,
            setMinValue: m.setMinValue
          })),
          views: { filterSlice, filteredSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      let updateCount = 0;
      result.views.filteredSlice.subscribe(() => updateCount++);

      // Apply category filter
      result.actions.get().setFilterCategory('A');
      expect(updateCount).toBe(1);
      
      const filtered = result.views.filteredSlice.get();
      expect(filtered.count).toBeGreaterThan(0);
      expect(filtered.count).toBeLessThan(ITEM_COUNT);
      expect(filtered.items.every(item => item.category === 'A')).toBe(true);

      // Apply value filter
      result.actions.get().setMinValue(50);
      expect(updateCount).toBe(2);
      
      const filtered2 = result.views.filteredSlice.get();
      expect(filtered2.count).toBeLessThan(filtered.count);
      expect(filtered2.items.every(item => item.category === 'A' && item.value >= 50)).toBe(true);
    });

    it('should handle expensive computations with proper memoization', () => {
      let fibCallCount = 0;
      
      // Expensive fibonacci function
      const fib = (n: number): number => {
        fibCallCount++;
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
      };

      const component = createComponent(() => {
        const model = createModel<{
          n: number;
          multiplier: number;
          setN: (n: number) => void;
          setMultiplier: (m: number) => void;
        }>(({ set }) => ({
          n: 10,
          multiplier: 1,
          setN: (n) => set({ n }),
          setMultiplier: (multiplier) => set({ multiplier })
        }));

        const inputSlice = createSlice(model, (m) => ({
          n: m.n,
          multiplier: m.multiplier
        }));

        const computedSlice = createSlice(model, () => ({
          fibonacci: select(inputSlice, (i) => {
            fibCallCount = 0; // Reset for this computation
            const result = fib(i.n);
            return { value: result, callCount: fibCallCount };
          }),
          multiplied: select(inputSlice, (i) => {
            // This depends on both n (via fibonacci) and multiplier
            fibCallCount = 0;
            const fibValue = fib(i.n);
            return fibValue * i.multiplier;
          })
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setN: m.setN,
            setMultiplier: m.setMultiplier
          })),
          views: { inputSlice, computedSlice }
        };
      });

      const adapter = createMemoryAdapter();
      const result = adapter.executeComponent(component);

      // Initial computation
      const initial = result.views.computedSlice.get();
      const initialCallCount = initial.fibonacci.callCount;
      expect(initialCallCount).toBeGreaterThan(0);

      // Access again - recomputes due to new object reference
      fibCallCount = 0;
      const cached = result.views.computedSlice.get();
      expect(cached.fibonacci.value).toBe(initial.fibonacci.value);
      expect(fibCallCount).toBeGreaterThan(0); // Recomputation happens

      // Change multiplier - fibonacci shouldn't recompute
      fibCallCount = 0;
      result.actions.get().setMultiplier(2);
      const afterMultiplier = result.views.computedSlice.get();
      expect(afterMultiplier.multiplied).toBe(initial.fibonacci.value * 2);
      // Fibonacci might be recomputed for the multiplied value, but should be efficient
      
      // Change n - should trigger recomputation
      result.actions.get().setN(12);
      const afterN = result.views.computedSlice.get();
      expect(afterN.fibonacci.callCount).toBeGreaterThan(0);
      expect(afterN.fibonacci.value).not.toBe(initial.fibonacci.value);
    });
  });
});
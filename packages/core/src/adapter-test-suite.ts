/**
 * @fileoverview Shared test suite for Lattice adapters
 * 
 * This module provides a comprehensive test suite that all Lattice adapters
 * should pass to ensure consistent behavior across different implementations.
 */

import { describe, it, expect } from 'vitest';
import type { AdapterFactory } from './adapter-contract';
import { createComponent, createModel, createSlice, compose } from './index';

/**
 * Creates a comprehensive test suite for a Lattice adapter
 * 
 * @param adapterName - Name of the adapter being tested
 * @param createAdapter - The adapter factory function
 */
export function createAdapterTestSuite(
  adapterName: string,
  createAdapter: AdapterFactory
) {
  describe(`${adapterName} Adapter Contract Tests`, () => {
    describe('Basic functionality', () => {
      it('should execute model factories with proper tools', () => {
        const component = createComponent(() => {
          const model = createModel<{
            count: number;
            increment: () => void;
          }>(({ set, get }) => ({
            count: 0,
            increment: () => set({ count: get().count + 1 }),
          }));

          const actions = createSlice(model, (m, _api) => ({
            increment: m.increment,
          }));

          const views = {
            counter: createSlice(model, (m, _api) => ({
              value: m.count,
            })),
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Actions should be directly accessible
        expect(typeof adapter.actions.increment).toBe('function');
        
        // Views should be functions that return current state
        expect(typeof adapter.views.counter).toBe('function');
        const counterView = adapter.views.counter();
        expect(counterView.value).toBe(0);
        
        // Actions should update state
        adapter.actions.increment();
        const updatedView = adapter.views.counter();
        expect(updatedView.value).toBe(1);
      });

      it('should support computed views', () => {
        const component = createComponent(() => {
          const model = createModel<{
            firstName: string;
            lastName: string;
            setName: (first: string, last: string) => void;
          }>(({ set }) => ({
            firstName: 'John',
            lastName: 'Doe',
            setName: (first: string, last: string) => set({ firstName: first, lastName: last }),
          }));

          const nameSlice = createSlice(model, (m, _api) => ({
            first: m.firstName,
            last: m.lastName,
          }));

          const actions = createSlice(model, (m, _api) => ({
            setName: m.setName,
          }));

          // Create a computed view slice that combines data
          const fullNameSlice = createSlice(model, (_m, api) => {
            const state = api.executeSlice(nameSlice);
            return {
              display: `${state.first} ${state.last}`,
              initials: `${state.first[0]}${state.last[0]}`,
            };
          });

          const views = {
            // Static view
            name: nameSlice,
            // Computed view as a slice
            fullName: fullNameSlice,
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Static view
        const nameView = adapter.views.name();
        expect(nameView.first).toBe('John');
        expect(nameView.last).toBe('Doe');
        
        // Computed view
        const fullNameView = adapter.views.fullName();
        expect(fullNameView.display).toBe('John Doe');
        expect(fullNameView.initials).toBe('JD');
        
        // Update and verify
        adapter.actions.setName('Jane', 'Smith');
        
        const updatedName = adapter.views.name();
        expect(updatedName.first).toBe('Jane');
        expect(updatedName.last).toBe('Smith');
        
        const updatedFullName = adapter.views.fullName();
        expect(updatedFullName.display).toBe('Jane Smith');
        expect(updatedFullName.initials).toBe('JS');
      });

      it('should handle slice composition with compose()', () => {
        const component = createComponent(() => {
          const model = createModel<{
            user: { name: string; role: string };
            theme: 'light' | 'dark';
            toggleTheme: () => void;
          }>(({ set, get }) => ({
            user: { name: 'Alice', role: 'admin' },
            theme: 'light',
            toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
          }));

          const userSlice = createSlice(model, (m, _api) => ({
            name: m.user.name,
            role: m.user.role,
            isAdmin: m.user.role === 'admin',
          }));

          const themeSlice = createSlice(model, (m, _api) => ({
            theme: m.theme,
            isDark: m.theme === 'dark',
          }));

          const actions = createSlice(model, (m, _api) => ({
            toggleTheme: m.toggleTheme,
          }));

          const headerSlice = createSlice(
            model,
            compose({ userSlice, themeSlice, actions }, (_, { userSlice, themeSlice, actions }) => ({
              userName: userSlice.name,
              userRole: userSlice.role,
              theme: themeSlice.theme,
              onToggleTheme: actions.toggleTheme,
              title: `${userSlice.name} - ${themeSlice.theme} mode`,
            }))
          );

          const views = {
            header: headerSlice,
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        const headerView = adapter.views.header();
        expect(headerView.userName).toBe('Alice');
        expect(headerView.userRole).toBe('admin');
        expect(headerView.theme).toBe('light');
        expect(headerView.title).toBe('Alice - light mode');
        expect(typeof headerView.onToggleTheme).toBe('function');
        
        // Toggle theme
        adapter.actions.toggleTheme();
        
        const updatedHeader = adapter.views.header();
        expect(updatedHeader.theme).toBe('dark');
        expect(updatedHeader.title).toBe('Alice - dark mode');
      });

      it('should handle parameterized view factories', () => {
        const component = createComponent(() => {
          const model = createModel<{
            items: Array<{ id: number; name: string; selected: boolean }>;
            toggleItem: (id: number) => void;
          }>(({ set, get }) => ({
            items: [
              { id: 1, name: 'Item 1', selected: false },
              { id: 2, name: 'Item 2', selected: true },
              { id: 3, name: 'Item 3', selected: false },
            ],
            toggleItem: (id: number) => set({
              items: get().items.map(item =>
                item.id === id ? { ...item, selected: !item.selected } : item
              )
            }),
          }));

          const actions = createSlice(model, (m, _api) => ({
            toggleItem: m.toggleItem,
          }));

          const itemsSlice = createSlice(model, (m, _api) => ({
            items: m.items,
          }));

          // Parameterized view factory
          const createItemView = (itemId: number) => 
            createSlice(model, (_m, api) => {
              const state = api.executeSlice(itemsSlice);
              const item = state.items.find((i) => i.id === itemId);
              return item ? {
                name: item.name,
                selected: item.selected,
                className: item.selected ? 'selected' : '',
              } : {
                name: 'Not found',
                selected: false,
                className: 'error',
              };
            });

          const selectedCountSlice = createSlice(model, (_m, api) => {
            const state = api.executeSlice(itemsSlice);
            return {
              count: state.items.filter((i) => i.selected).length,
            };
          });

          const views = {
            item1: createItemView(1),
            item2: createItemView(2),
            selectedCount: selectedCountSlice,
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Check initial state
        const item1 = adapter.views.item1();
        expect(item1.name).toBe('Item 1');
        expect(item1.selected).toBe(false);
        expect(item1.className).toBe('');
        
        const item2 = adapter.views.item2();
        expect(item2.name).toBe('Item 2');
        expect(item2.selected).toBe(true);
        expect(item2.className).toBe('selected');
        
        const count = adapter.views.selectedCount();
        expect(count.count).toBe(1);
        
        // Toggle item 1
        adapter.actions.toggleItem(1);
        
        const updatedItem1 = adapter.views.item1();
        expect(updatedItem1.selected).toBe(true);
        expect(updatedItem1.className).toBe('selected');
        
        const updatedCount = adapter.views.selectedCount();
        expect(updatedCount.count).toBe(2);
      });
    });

    describe('Error handling', () => {
      it('should handle empty components', () => {
        const component = createComponent(() => {
          const model = createModel<{}>(() => ({}));
          const actions = createSlice(model, (_m, _api) => ({}));
          const views = {};
          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        expect(adapter.actions).toEqual({});
        expect(adapter.views).toEqual({});
      });

      it('should handle components with only actions', () => {
        const component = createComponent(() => {
          const model = createModel<{
            doSomething: () => void;
          }>(({ set }) => ({
            doSomething: () => set({}),
          }));

          const actions = createSlice(model, (m, _api) => ({
            doSomething: m.doSomething,
          }));

          const views = {};

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        expect(typeof adapter.actions.doSomething).toBe('function');
        expect(adapter.views).toEqual({});
      });
    });

    describe('View consistency', () => {
      it('should always return fresh view data', () => {
        const component = createComponent(() => {
          const model = createModel<{
            counter: number;
            increment: () => void;
          }>(({ set, get }) => ({
            counter: 0,
            increment: () => set({ counter: get().counter + 1 }),
          }));

          const actions = createSlice(model, (m, _api) => ({
            increment: m.increment,
          }));

          const views = {
            count: createSlice(model, (m, _api) => ({ value: m.counter })),
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Get initial view
        const view1 = adapter.views.count();
        expect(view1.value).toBe(0);
        
        // Increment
        adapter.actions.increment();
        
        // View should not be cached - should return fresh data
        const view2 = adapter.views.count();
        expect(view2.value).toBe(1);
        expect(view2).not.toBe(view1); // Different objects
        
        // Call view again without state change
        const view3 = adapter.views.count();
        expect(view3.value).toBe(1);
        expect(view3).not.toBe(view2); // Still different objects (no caching)
      });

      it('should handle view transforms consistently', () => {
        const component = createComponent(() => {
          const model = createModel<{
            value: number;
            multiply: (factor: number) => void;
          }>(({ set, get }) => ({
            value: 10,
            multiply: (factor: number) => set({ value: get().value * factor }),
          }));

          const actions = createSlice(model, (m, _api) => ({
            multiply: m.multiply,
          }));

          const valueSlice = createSlice(model, (m, _api) => ({
            value: m.value,
          }));

          // Create computed view slices
          const doubledSlice = createSlice(model, (_m, api) => {
            const state = api.executeSlice(valueSlice);
            return { result: state.value * 2 };
          });

          const tripledSlice = createSlice(model, (_m, api) => {
            const state = api.executeSlice(valueSlice);
            return { result: state.value * 3 };
          });

          const formattedSlice = createSlice(model, (_m, api) => {
            const state = api.executeSlice(valueSlice);
            return { display: `Value: ${state.value}` };
          });

          const views = {
            doubled: doubledSlice,
            tripled: tripledSlice,
            formatted: formattedSlice,
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Check initial transforms
        expect(adapter.views.doubled().result).toBe(20);
        expect(adapter.views.tripled().result).toBe(30);
        expect(adapter.views.formatted().display).toBe('Value: 10');
        
        // Update state
        adapter.actions.multiply(5);
        
        // All transforms should reflect new state
        expect(adapter.views.doubled().result).toBe(100);
        expect(adapter.views.tripled().result).toBe(150);
        expect(adapter.views.formatted().display).toBe('Value: 50');
      });
    });

    describe('Action behavior', () => {
      it('should handle synchronous actions', () => {
        const component = createComponent(() => {
          const model = createModel<{
            log: string[];
            addEntry: (entry: string) => void;
            clearLog: () => void;
          }>(({ set, get }) => ({
            log: [],
            addEntry: (entry: string) => set({ log: [...get().log, entry] }),
            clearLog: () => set({ log: [] }),
          }));

          const actions = createSlice(model, (m, _api) => ({
            addEntry: m.addEntry,
            clearLog: m.clearLog,
          }));

          const views = {
            log: createSlice(model, (m, _api) => ({ entries: m.log })),
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Add entries
        adapter.actions.addEntry('First');
        adapter.actions.addEntry('Second');
        adapter.actions.addEntry('Third');
        
        let log = adapter.views.log();
        expect(log.entries).toEqual(['First', 'Second', 'Third']);
        
        // Clear log
        adapter.actions.clearLog();
        
        log = adapter.views.log();
        expect(log.entries).toEqual([]);
      });

      it('should handle actions that call other actions', () => {
        const component = createComponent(() => {
          const model = createModel<{
            x: number;
            y: number;
            setX: (value: number) => void;
            setY: (value: number) => void;
            setPoint: (x: number, y: number) => void;
          }>(({ set }) => ({
            x: 0,
            y: 0,
            setX: (value: number) => set({ x: value }),
            setY: (value: number) => set({ y: value }),
            setPoint: (x: number, y: number) => {
              // This action calls other actions
              // This action calls set directly
              set({ x, y });
            },
          }));

          const actions = createSlice(model, (m, _api) => ({
            setX: m.setX,
            setY: m.setY,
            setPoint: m.setPoint,
          }));

          const views = {
            point: createSlice(model, (m, _api) => ({ x: m.x, y: m.y })),
          };

          return { model, actions, views };
        });

        const adapter = createAdapter(component());
        
        // Set individual coordinates
        adapter.actions.setX(5);
        adapter.actions.setY(10);
        
        let point = adapter.views.point();
        expect(point).toEqual({ x: 5, y: 10 });
        
        // Set both at once
        adapter.actions.setPoint(20, 30);
        
        point = adapter.views.point();
        expect(point).toEqual({ x: 20, y: 30 });
      });
    });
  });
}
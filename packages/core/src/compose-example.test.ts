/**
 * @fileoverview Example demonstrating the purely functional compose approach
 * 
 * This example shows how compose() creates a multi-layered function structure
 * that encodes composition data without using object properties.
 */

import { describe, it, expect } from 'vitest';
import { createComponent, createModel, createSlice, compose } from './index';

describe('Purely Functional Compose Example', () => {
  it('demonstrates the multi-layer function approach', () => {
    // Define a component with compose
    const component = createComponent(() => {
      const model = createModel<{
        user: { name: string; role: string };
        theme: 'light' | 'dark';
        count: number;
        increment: () => void;
        toggleTheme: () => void;
      }>(({ set, get }) => ({
        user: { name: 'Alice', role: 'admin' },
        theme: 'light',
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' })
      }));

      // Create base slices
      const userSlice = createSlice(model, (m) => ({
        name: m.user.name,
        role: m.user.role,
        isAdmin: m.user.role === 'admin'
      }));

      const themeSlice = createSlice(model, (m) => ({
        theme: m.theme,
        isDark: m.theme === 'dark'
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        toggleTheme: m.toggleTheme
      }));

      // Create a composed slice using the purely functional approach
      const dashboardSlice = createSlice(
        model,
        compose(
          { userSlice, themeSlice, actions },
          (m, { userSlice, themeSlice, actions }) => ({
            // From model
            count: m.count,
            
            // From composed slices
            userName: userSlice.name,
            isAdmin: userSlice.isAdmin,
            theme: themeSlice.theme,
            isDarkMode: themeSlice.isDark,
            
            // Actions
            onIncrement: actions.increment,
            onToggleTheme: actions.toggleTheme,
            
            // Computed from multiple sources
            title: `${userSlice.name}'s Dashboard (${themeSlice.theme} mode)`
          })
        )
      );

      return {
        model,
        actions,
        views: {
          dashboard: dashboardSlice
        }
      };
    });

    // The compose function creates a multi-layer function structure
    const spec = component();
    
    // When createSlice executes with a compose spec, it returns a marker
    const modelData = {
      user: { name: 'Bob', role: 'user' },
      theme: 'dark' as const,
      count: 5,
      increment: () => {},
      toggleTheme: () => {}
    };
    
    const result = spec.views.dashboard(modelData);
    
    // The result contains the compose spec marker
    expect(result).toHaveProperty('__composeSpec');
    expect(result).toHaveProperty('__isComposeSpec', true);
    
    // The compose spec contains dependencies and a curried selector
    const composeSpec = (result as any).__composeSpec;
    expect(composeSpec).toHaveProperty('dependencies');
    expect(composeSpec).toHaveProperty('selector');
    
    // Dependencies are the slice factories
    expect(composeSpec.dependencies).toHaveProperty('userSlice');
    expect(composeSpec.dependencies).toHaveProperty('themeSlice');
    expect(composeSpec.dependencies).toHaveProperty('actions');
    
    // The selector is a curried function that expects resolved dependencies
    expect(typeof composeSpec.selector).toBe('function');
    
    // Demonstrate how adapters would process this
    // 1. Execute each dependency slice
    const resolvedDeps = {
      userSlice: composeSpec.dependencies.userSlice(modelData),
      themeSlice: composeSpec.dependencies.themeSlice(modelData),
      actions: composeSpec.dependencies.actions(modelData)
    };
    
    // 2. Call the curried selector with resolved dependencies
    const finalResult = composeSpec.selector(resolvedDeps);
    
    // 3. The final result has all the composed data
    expect(finalResult).toEqual({
      count: 5,
      userName: 'Bob',
      isAdmin: false,
      theme: 'dark',
      isDarkMode: true,
      onIncrement: expect.any(Function),
      onToggleTheme: expect.any(Function),
      title: "Bob's Dashboard (dark mode)"
    });
  });

  it('shows how the compose function layers work', () => {
    const model = createModel<{ x: number; y: number }>(() => ({ x: 0, y: 0 }));
    const xSlice = createSlice(model, (m) => ({ value: m.x }));
    const ySlice = createSlice(model, (m) => ({ value: m.y }));
    
    // Create a compose spec
    const composeSpec = compose<{ x: number; y: number }, { x: typeof xSlice; y: typeof ySlice }, { sum: number }>(
      { x: xSlice, y: ySlice },
      (_, deps) => ({ sum: deps.x.value + deps.y.value })
    );
    
    // Layer 1: No arguments returns dependencies
    const deps = composeSpec();
    expect(deps).toEqual({ x: xSlice, y: ySlice });
    
    // Layer 2: With model returns partially applied function
    const modelData = { x: 3, y: 4 };
    const partiallyApplied = composeSpec(modelData);
    expect(typeof partiallyApplied).toBe('function');
    
    // The partially applied function can be called with resolved dependencies
    const result = partiallyApplied({ x: { value: 3 }, y: { value: 4 } });
    expect(result).toEqual({ sum: 7 });
  });
});
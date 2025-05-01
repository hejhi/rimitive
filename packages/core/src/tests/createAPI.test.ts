import { describe, it, expect, vi } from 'vitest';
import { createAPI } from '../index';
import { create } from 'zustand';
import { withStoreSync } from '../index';

describe('createAPI', () => {
  it('should create an API store with basic config', () => {
    // Define a simple config for the API store
    const config = (set: Function, get: Function) => ({
      count: 0,
      increment: () =>
        set((state: { count: number }) => ({ count: state.count + 1 })),
      getCount: () => get().count,
    });

    // Create API using the config
    const { api, hooks } = createAPI(config);

    // Verify the API store has the correct structure
    expect(api).toBeDefined();
    expect(typeof api.getState).toBe('function');
    expect(typeof api.setState).toBe('function');
    expect(typeof api.subscribe).toBe('function');

    // Verify the API contains the state and methods from the config
    let state = api.getState();
    expect(state.count).toBe(0);
    expect(typeof state.increment).toBe('function');
    expect(typeof state.getCount).toBe('function');

    // Test API functionality
    state.increment();

    // Get the latest state from the store after increment
    state = api.getState();
    expect(state.count).toBe(1);
    expect(state.getCount()).toBe(1);

    // Verify the hooks interface
    expect(hooks).toBeDefined();
    expect(typeof hooks.before).toBe('function');
    expect(typeof hooks.after).toBe('function');
  });

  it('should execute hooks when API methods are called', () => {
    // Define a config with testable methods
    const config = (set: Function, _get: Function) => ({
      value: 'initial',
      updateValue: (newValue: string) => set({ value: newValue }),
      processValue: (input: string) => `processed:${input}`,
    });

    // Create API
    const { api, hooks } = createAPI(config);

    // Create spy functions for before and after hooks
    const beforeSpy = vi.fn();
    const afterSpy = vi.fn();

    // Register hooks
    hooks.before('processValue', beforeSpy);
    hooks.after('processValue', afterSpy);

    // Call the method that should trigger hooks
    const result = api.getState().processValue('test');

    // Verify hooks were called with correct arguments
    expect(beforeSpy).toHaveBeenCalledWith('test');
    expect(afterSpy).toHaveBeenCalledWith('processed:test', 'test');
    expect(result).toBe('processed:test');
  });

  it('should allow hooks to modify arguments and return values', () => {
    // Define a config with testable methods
    const config = (_set: Function, _get: Function) => ({
      multiply: (a: number, b: number) => a * b,
    });

    // Create API
    const { api, hooks } = createAPI(config);

    // Create hooks that modify inputs and outputs
    hooks.before('multiply', (a: number, _b: number) => a + 1); // Modify first argument
    hooks.after('multiply', (result: number) => result * 2); // Double the result

    // Call the method
    const result = api.getState().multiply(2, 3);

    // With modified inputs (3 * 3) and doubled output, should be 18
    expect(result).toBe(18);
  });

  it('should properly integrate with withStoreSync middleware', () => {
    // Create a source store
    const sourceStore = create(() => ({
      count: 0,
      name: 'test',
      increment: () =>
        sourceStore.setState((state) => ({ count: state.count + 1 })),
      updateName: (name: string) => sourceStore.setState({ name }),
    }));

    // Create an additional source store to test multiple store synchronization
    const configStore = create(() => ({
      theme: 'light',
      language: 'en',
      setTheme: (theme: string) => configStore.setState({ theme }),
      setLanguage: (lang: string) => configStore.setState({ language: lang }),
    }));

    // Create API with withStoreSync middleware and multiple source stores
    // Use type any to bypass complex middleware typing issues
    // This is acceptable in a test where we care about runtime behavior more than type safety
    const { api } = createAPI(
      withStoreSync(
        { sourceStore, configStore },
        ({ sourceStore, configStore }) => ({
          syncedCount: sourceStore.count,
          syncedName: sourceStore.name,
          syncedTheme: configStore.theme,
          syncedLanguage: configStore.language,
        })
      )((_set: any, get: any) => ({
        getFormattedCount: () => `Count: ${get().syncedCount}`,
        getFullName: (suffix: string) => `${get().syncedName} ${suffix}`,
        getThemedName: () => `${get().syncedName} (${get().syncedTheme})`,
        incrementSource: () => sourceStore.getState().increment(),
        changeTheme: (theme: string) => configStore.getState().setTheme(theme),
      }))
    );

    // Initial state check
    expect(api.getState()).toHaveProperty('syncedCount', 0);
    expect(api.getState()).toHaveProperty('syncedName', 'test');
    expect(api.getState()).toHaveProperty('syncedTheme', 'light');
    expect(api.getState()).toHaveProperty('syncedLanguage', 'en');

    // Update source stores
    sourceStore.getState().increment();
    sourceStore.getState().updateName('newTest');

    // Verify API updates when source stores change
    expect(api.getState()).toHaveProperty('syncedCount', 1);
    expect(api.getState()).toHaveProperty('syncedName', 'newTest');
  });
});

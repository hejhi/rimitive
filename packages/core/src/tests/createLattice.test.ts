import { describe, it, expect, vi } from 'vitest';
import { createLattice, createAPI, createProps, withLattice } from '../index';
import { Lattice } from '../types';

describe('createLattice', () => {
  it('should create a lattice with the given name and empty configuration', () => {
    const lattice = createLattice('test');

    expect(lattice).toBeDefined();
    expect(lattice.name).toBe('test');
    expect(typeof lattice.use).toBe('function');
  });

  it('should create a lattice with the given name and full configuration', () => {
    // Create actual API with proper types
    interface TestState {
      count: number;
      increment: () => void;
    }

    const { api, hooks } = createAPI<TestState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    // Create actual props
    const buttonProps = createProps('button', () => ({
      get: () => ({ 'aria-label': 'Test Button' }),
    }));

    const inputProps = createProps('input', () => ({
      get: () => ({ 'aria-label': 'Test Input' }),
    }));

    // First create a base lattice to get a real use function
    const baseLattice = createLattice<TestState>('base', { api });

    // Spy on the real use method
    const useSpy = vi.spyOn(baseLattice, 'use');

    // Now create a new lattice with the same config plus our spied use function
    const lattice = createLattice<TestState>('test', {
      api,
      hooks,
      props: {
        button: buttonProps,
        input: inputProps,
      },
      use: baseLattice.use,
    });

    expect(lattice).toBeDefined();
    expect(lattice.name).toBe('test');
    expect(lattice.api).toBe(api);
    expect(lattice.hooks).toBe(hooks);
    expect(lattice.props.button).toBe(buttonProps);
    expect(lattice.props.input).toBe(inputProps);
    expect(lattice.use).toBe(baseLattice.use);

    // Create a realistic enhancer using proper patterns
    interface ThemeState {
      theme: string;
      toggleTheme: () => void;
    }

    const createThemeEnhancer = () => {
      return (baseLattice: Lattice<TestState>) => {
        // Create new API for the theme feature
        const { api: themeAPI } = createAPI<ThemeState>((set) => ({
          theme: 'light',
          toggleTheme: () =>
            set((state) => ({
              theme: state.theme === 'light' ? 'dark' : 'light',
            })),
        }));

        // Use withLattice to properly compose the lattices
        return createLattice(
          'themed',
          withLattice(baseLattice)({
            api: themeAPI,
          })
        );
      };
    };

    // Get the enhancer function
    const themeEnhancer = createThemeEnhancer();

    // Use the enhancer
    lattice.use(themeEnhancer);

    // Verify the spy was called with the enhancer
    expect(useSpy).toHaveBeenCalledWith(themeEnhancer);
  });

  it('should provide a default use function if not provided', () => {
    // Create a simple lattice
    interface SimpleState {
      value: string;
      setValue: (val: string) => void;
    }

    const { api } = createAPI<SimpleState>((set) => ({
      value: 'initial',
      setValue: (val: string) => set({ value: val }),
    }));

    const lattice = createLattice<SimpleState>('test', { api });

    // Create a spy on the real use method
    const useSpy = vi.spyOn(lattice, 'use');

    // Create a realistic logger enhancer
    interface LoggerState {
      logs: string[];
      log: (message: string) => void;
      clearLogs: () => void;
    }

    const createLoggerEnhancer = () => {
      return (baseLattice: Lattice<SimpleState>) => {
        // Create new API for logging
        const { api: loggerAPI } = createAPI<LoggerState>((set) => ({
          logs: [],
          log: (message) =>
            set((state) => ({
              logs: [...state.logs, message],
            })),
          clearLogs: () => set({ logs: [] }),
        }));

        // Use withLattice to properly compose the lattices
        return createLattice(
          'logger',
          withLattice(baseLattice)({
            api: loggerAPI,
          })
        );
      };
    };

    // Get the enhancer function
    const loggerEnhancer = createLoggerEnhancer();

    // Use the enhancer with the spied method
    const enhancedLattice = lattice.use(loggerEnhancer);

    // Verify the method was called with the enhancer
    expect(useSpy).toHaveBeenCalledWith(loggerEnhancer);

    // Verify the enhancement was applied correctly
    expect(enhancedLattice.name).toBe('logger');

    // Test the combined API
    const state = enhancedLattice.api.getState();
    expect(state).toHaveProperty('value');
    expect(state).toHaveProperty('setValue');
    expect(state).toHaveProperty('logs');
    expect(state).toHaveProperty('log');
    expect(state).toHaveProperty('clearLogs');
    expect(state.logs).toEqual([]);
  });
});

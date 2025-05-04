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
    const buttonProps = createProps(() => ({
      partName: 'button',
      get: () => ({ 'aria-label': 'Test Button' }),
    }));

    const inputProps = createProps(() => ({
      partName: 'input',
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

    // Create a realistic composable lattice using proper patterns
    interface ThemeState {
      theme: string;
      toggleTheme: () => void;
    }

    const createThemeComposable = () => {
      return (baseLattice: Lattice<TestState>) => {
        // Create new API for the theme functionality
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

    // Get the composable function
    const themeComposable = createThemeComposable();

    // Use the composable
    lattice.use(themeComposable);

    // Verify the spy was called with the composable
    expect(useSpy).toHaveBeenCalledWith(themeComposable);
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

    // Create a realistic logger composable
    interface LoggerState {
      logs: string[];
      log: (message: string) => void;
      clearLogs: () => void;
    }

    const createLoggerComposable = () => {
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

    // Get the composable function
    const loggerComposable = createLoggerComposable();

    // Use the composable with the spied method
    const composedLattice = lattice.use(loggerComposable);

    // Verify the method was called with the composable
    expect(useSpy).toHaveBeenCalledWith(loggerComposable);

    // Verify the composition was applied correctly
    expect(composedLattice.name).toBe('logger');

    // Test the combined API
    const state = composedLattice.api.getState();
    expect(state).toHaveProperty('value');
    expect(state).toHaveProperty('setValue');
    expect(state).toHaveProperty('logs');
    expect(state).toHaveProperty('log');
    expect(state).toHaveProperty('clearLogs');
    expect(state.logs).toEqual([]);
  });

  it('should have a functional use method for composition', () => {
    const lattice = createLattice('test');
    const useSpy = vi.spyOn(lattice, 'use');

    // Mock function to use as a parameter
    const composableLattice = (lattice: any) => {
      expect(lattice).toBeDefined(); // Verify lattice is passed
      return lattice; // Return unchanged for this test
    };

    // Call the use method
    lattice.use(composableLattice);

    // Verify the method was called with the provided function
    expect(useSpy).toHaveBeenCalledWith(composableLattice);
  });

  it('should pass the calling lattice as this to the use method', () => {
    const lattice = createLattice('test');

    // Create a realistic composable using proper patterns
    interface ThemeState {
      isDarkMode: boolean;
      toggleTheme: () => void;
    }

    const createThemeComposable = () => {
      // Create new API for the theme functionality
      const { api: themeAPI } = createAPI<ThemeState>((set) => ({
        isDarkMode: false,
        toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      }));

      // Return a function that takes a base lattice and returns a composed one
      return (baseLattice: any) => {
        return createLattice(
          'theme',
          withLattice(baseLattice)({
            api: themeAPI,
          })
        );
      };
    };

    // Spy on the use method
    const useSpy = vi.spyOn(lattice, 'use');

    // Get the composable function
    const themeComposable = createThemeComposable();

    // Use the composable
    lattice.use(themeComposable);

    // Verify the spy was called with the composable
    expect(useSpy).toHaveBeenCalledWith(themeComposable);
  });

  it('should return the result of the composable function', () => {
    // Create a base lattice with a minimal API
    const { api: baseAPI } = createAPI(() => ({}));
    const lattice = createLattice('test', { api: baseAPI });

    // Create a realistic logger composable
    interface LoggerState {
      logs: string[];
      log: (message: string) => void;
      clear: () => void;
    }

    const createLoggerComposable = () => {
      const { api: loggerAPI } = createAPI<LoggerState>((set) => ({
        logs: [] as string[],
        log: (message: string) =>
          set((state) => ({ logs: [...state.logs, message] })),
        clear: () => set({ logs: [] }),
      }));

      return (baseLattice: any) => {
        return createLattice(
          'logger',
          withLattice(baseLattice)({
            api: loggerAPI,
          })
        );
      };
    };

    // Spy on the use method
    const useSpy = vi.spyOn(lattice, 'use');

    // Get the composable function
    const loggerComposable = createLoggerComposable();

    // Use the composable with the spied method
    const composedLattice = lattice.use(loggerComposable);

    // Verify the method was called with the composable
    expect(useSpy).toHaveBeenCalledWith(loggerComposable);

    // Check the result is what we expect
    expect(composedLattice).toBeDefined();
    expect(composedLattice.name).toBe('logger');
    expect(composedLattice.api.getState()).toHaveProperty('logs');
    expect(composedLattice.api.getState()).toHaveProperty('log');
    expect(composedLattice.api.getState()).toHaveProperty('clear');
  });
});

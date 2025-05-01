/**
 * Tests for lattice composition following the spec
 */
import { describe, expect, it } from 'vitest';
import { createLattice, Lattice } from '../createLattice';
import { createAPI } from '../createAPI';
import { create } from 'zustand';
import { withLattice } from '../withLattice';

describe('Lattice Composition', () => {
  it('should allow enhancing a lattice with another lattice', () => {
    // Create a base lattice
    const { api: baseAPI } = createAPI((set) => ({
      value: 0,
      setValue: (value: number) => set({ value }),
    }));

    const baseLattice = createLattice('base', {
      api: baseAPI,
    });

    // Create a counter feature enhancer (following spec pattern)
    const createCounterFeature = () => {
      // Return a function that takes a base lattice and returns an enhanced lattice
      return (baseLattice: Lattice): Lattice => {
        // Create the counter API
        interface CounterState {
          count: number;
          increment: () => void;
          decrement: () => void;
        }

        const { api: counterAPI, hooks: counterHooks } =
          createAPI<CounterState>((set) => ({
            count: 0,
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
          }));

        // Create counter props
        const counterProps = create(() => ({
          get: () => ({
            'aria-label': 'Counter',
            'data-count': (counterAPI.getState() as CounterState).count,
          }),
        }));

        // Return enhanced lattice (following spec pattern)
        return createLattice(
          'counter',
          withLattice(baseLattice)({
            api: counterAPI,
            hooks: counterHooks,
            props: {
              counter: counterProps,
            },
          })
        );
      };
    };

    // Create and apply the counter feature
    const counterFeature = createCounterFeature();
    const enhancedLattice = baseLattice.use(counterFeature);

    // Check if the enhancement was properly applied
    expect(enhancedLattice.name).toBe('counter'); // Per spec, name comes from the enhancer

    // Get API state to check for counter methods
    const apiState = enhancedLattice.api.getState();
    expect(apiState).toHaveProperty('increment');
    expect(apiState).toHaveProperty('decrement');
    expect(enhancedLattice.props).toHaveProperty('counter');

    // Verify base functionality is preserved
    expect(apiState).toHaveProperty('setValue');
  });

  it('should allow chaining multiple lattice enhancements', () => {
    // Create base lattice
    const { api: baseAPI } = createAPI((_set) => ({
      initialized: true,
    }));

    const baseLattice = createLattice('base', {
      api: baseAPI,
    });

    // Create counter feature
    const createCounterFeature =
      () =>
      (baseLattice: Lattice): Lattice => {
        interface CounterState {
          count: number;
          increment: () => void;
        }

        const { api: counterAPI } = createAPI<CounterState>((set) => ({
          count: 0,
          increment: () => set((state) => ({ count: state.count + 1 })),
        }));

        return createLattice(
          'counter',
          withLattice(baseLattice)({
            api: counterAPI,
          })
        );
      };

    // Create logger feature
    const createLoggerFeature =
      () =>
      (baseLattice: Lattice): Lattice => {
        interface LoggerState {
          logs: string[];
          log: (message: string) => void;
        }

        const { api: loggerAPI } = createAPI<LoggerState>((set) => ({
          logs: [] as string[],
          log: (message: string) =>
            set((state) => ({
              logs: [...state.logs, message],
            })),
        }));

        return createLattice(
          'logger',
          withLattice(baseLattice)({
            api: loggerAPI,
          })
        );
      };

    // Apply features in sequence
    const counterFeature = createCounterFeature();
    const loggerFeature = createLoggerFeature();
    const enhancedLattice = baseLattice.use(counterFeature).use(loggerFeature);

    // Check that the name is from the last applied feature
    expect(enhancedLattice.name).toBe('logger');

    // Check that all APIs are accessible
    const apiState = enhancedLattice.api.getState();
    expect(apiState).toHaveProperty('increment');
    expect(apiState).toHaveProperty('log');
    expect(apiState).toHaveProperty('initialized');
  });
});

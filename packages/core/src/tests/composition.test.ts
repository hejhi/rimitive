/**
 * Tests for lattice composition following the spec
 */
import { describe, expect, it } from 'vitest';
import { createLattice } from '../createLattice';
import { createAPI } from '../createAPI';
import { withLattice } from '../withLattice';
import { createProps } from '../createProps';
import { Lattice } from '../types';

describe('Lattice Composition', () => {
  it('should allow enhancing a lattice with another lattice', () => {
    // Create a base lattice
    interface BaseState {
      value: number;
      setValue: (value: number) => void;
    }

    const { api: baseAPI } = createAPI<BaseState>((set) => ({
      value: 0,
      setValue: (value: number) => set({ value }),
    }));

    const baseLattice = createLattice<BaseState>('base', { api: baseAPI });

    // Create a counter feature enhancer (following spec pattern)
    interface CounterState {
      count: number;
      increment: () => void;
      decrement: () => void;
    }

    const createCounterFeature = () => {
      // Return a function that takes a base lattice and returns an enhanced lattice
      return (baseLattice: Lattice<BaseState>) => {
        const { api: counterAPI, hooks: counterHooks } =
          createAPI<CounterState>((set) => ({
            count: 0,
            increment: () => set((state) => ({ count: state.count + 1 })),
            decrement: () => set((state) => ({ count: state.count - 1 })),
          }));

        // Create counter props
        const counterProps = createProps('counter', () => ({
          get: () => ({
            'aria-label': 'Counter',
            'data-count': (counterAPI.getState() as CounterState).count,
          }),
        }));

        // Return enhanced lattice (following spec pattern)
        return createLattice<BaseState & CounterState>(
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
    const composedLattice = baseLattice.use(counterFeature);

    // Check if the enhancement was properly applied
    expect(composedLattice.name).toBe('counter'); // Per spec, name comes from the enhancer

    // Get API state to check for counter methods
    const apiState = composedLattice.api.getState();

    expect(apiState).toHaveProperty('increment');
    expect(apiState).toHaveProperty('decrement');
    expect(composedLattice.props).toHaveProperty('counter');

    // Verify base functionality is preserved
    expect(apiState).toHaveProperty('setValue');
  });

  it('should allow chaining multiple lattice enhancements', () => {
    // Create base lattice
    interface BaseState {
      initialized: boolean;
    }

    const { api: baseAPI } = createAPI<BaseState>((_set) => ({
      initialized: true,
    }));

    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
    });

    // Create counter feature
    interface CounterState {
      count: number;
      increment: () => void;
    }

    const createCounterFeature = () => (baseLattice: Lattice<BaseState>) => {
      const { api: counterAPI } = createAPI<CounterState>((set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      }));

      return createLattice<BaseState & CounterState>(
        'counter',
        withLattice(baseLattice)({
          api: counterAPI,
        })
      );
    };

    // Create logger feature
    interface LoggerState {
      logs: string[];
      log: (message: string) => void;
    }

    const createLoggerFeature =
      () => (baseLattice: Lattice<BaseState & CounterState>) => {
        const { api: loggerAPI } = createAPI<LoggerState>((set) => ({
          logs: [] as string[],
          log: (message: string) =>
            set((state) => ({
              logs: [...state.logs, message],
            })),
        }));

        return createLattice<BaseState & CounterState & LoggerState>(
          'logger',
          withLattice(baseLattice)({
            api: loggerAPI,
          })
        );
      };

    // Apply features in sequence
    const counterFeature = createCounterFeature();
    const loggerFeature = createLoggerFeature();
    // Type inference works properly with our changes
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

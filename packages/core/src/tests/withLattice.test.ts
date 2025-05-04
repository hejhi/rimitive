import { describe, it, expect, vi } from 'vitest';
import {
  withLattice,
  mergeProps,
  createProps,
  createLattice,
  createAPI,
} from '../index';
import { Lattice } from '../types';

describe('withLattice', () => {
  it('should merge API objects from base lattice and config', () => {
    // Create base API with proper typing
    interface BaseState {
      baseMethod: () => string;
      sharedMethod: () => string;
    }

    const { api: baseAPI } = createAPI<BaseState>(() => ({
      baseMethod: () => 'base',
      sharedMethod: () => 'base-shared',
    }));

    // Create a proper base lattice
    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
      props: {
        button: createProps(() => ({
          partName: 'button',
          get: () => ({ base: true }),
        })),
      },
    });

    // Create config API with proper typing
    interface ConfigState {
      configMethod: () => string;
      sharedMethod: () => string;
    }

    const { api: configAPI } = createAPI<ConfigState>(() => ({
      configMethod: () => 'config',
      sharedMethod: () => 'config-shared',
    }));

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware({
      api: configAPI,
    });

    // Verify that the API objects are properly merged
    expect(result.api).toBeDefined();
    const combinedLattice = createLattice<BaseState & ConfigState>(
      'combined',
      result
    );
    const state = combinedLattice.api.getState();

    expect(state.baseMethod()).toBe('base');
    expect(state.configMethod()).toBe('config');
    expect(state.sharedMethod()).toBe('config-shared'); // Config overrides base
  });

  it('should merge hooks from base lattice and config', () => {
    // Create a properly typed base lattice
    interface BaseState {
      value: number;
    }

    const { api: baseAPI } = createAPI<BaseState>(() => ({
      value: 0,
    }));

    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
    });

    // Create custom hooks
    const beforeHook = vi.fn();
    const afterHook = vi.fn();

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware({
      hooks: {
        before: beforeHook,
        after: afterHook,
      },
    });

    // Verify that hooks are properly merged
    expect(result.hooks).toBeDefined();
    expect(result.hooks!.before).toBe(beforeHook);
    expect(result.hooks!.after).toBe(afterHook);
  });

  it('should merge props objects with special merge logic', () => {
    // Define props objects
    const baseProps = createProps(() => ({
      partName: 'button',
      get: () => ({ base: true }),
    }));
    const configProps = createProps(() => ({
      partName: 'button',
      get: () => ({ config: true }),
    }));

    // Create a base lattice with props
    interface BaseState {
      value: number;
    }

    const { api: baseAPI } = createAPI<BaseState>(() => ({
      value: 0,
    }));

    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
      props: {
        button: baseProps,
        input: createProps(() => ({
          partName: 'input',
          get: () => ({ baseInput: true }),
        })),
      },
    });

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware({
      props: {
        button: configProps,
        select: createProps(() => ({
          partName: 'select',
          get: () => ({ select: true }),
        })),
      },
    });

    // Create a composed lattice from the result
    const composedLattice = createLattice('composed', result);

    // Verify that props are properly merged
    expect(composedLattice.props).toBeDefined();

    // Since we're using the actual mergeProps function, the result should be what mergeProps returns
    // when applied to the base and config props
    expect(composedLattice.props.button).toEqual(
      mergeProps(baseProps, configProps).button
    );
    expect(composedLattice.props.input).toEqual(baseLattice.props.input);
    expect(composedLattice.props.select).toBeTruthy();
  });

  it('should preserve the use method', () => {
    // Create a base lattice with the standard use method
    interface BaseState {
      value: number;
    }

    const { api: baseAPI } = createAPI<BaseState>(() => ({
      value: 0,
    }));

    // Create a spy to check if the use method is called
    const useSpy = vi.fn();

    // First create the lattice without custom use
    const tempLattice = createLattice<BaseState>('base', {
      api: baseAPI,
    });

    // Then add the custom use method
    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
      // Use a more Zustand-like approach for composed middleware
      use: <U>(
        compose: (lattice: Lattice<BaseState>) => Lattice<BaseState & U>
      ): Lattice<BaseState & U> => {
        useSpy();
        return compose(tempLattice);
      },
    });

    // Create a simple config
    const middleware = withLattice(baseLattice);
    const result = middleware({});

    // Create a composed lattice
    const composedLattice = createLattice('composed', result);

    // Create a simple lattice composer that just returns its input lattice
    const lattice = <T>(lattice: Lattice<T>): Lattice<T> => lattice;

    // Use any to bypass the type issue in the test
    composedLattice.use(lattice);

    // Verify the spy was called
    expect(useSpy).toHaveBeenCalled();
  });

  it('should correctly handle props stores with partName metadata', () => {
    // Create actual props stores with partName metadata using createProps
    const baseButtonProps = createProps(() => ({
      partName: 'button',
      get: () => ({ role: 'button', baseAttr: true }),
    }));

    const baseInputProps = createProps(() => ({
      partName: 'input',
      get: () => ({ role: 'textbox', baseInputAttr: true }),
    }));

    const configButtonProps = createProps(() => ({
      partName: 'button',
      get: () => ({ type: 'submit', configAttr: true }),
    }));

    const configSelectProps = createProps(() => ({
      partName: 'select',
      get: () => ({ role: 'listbox', configSelectAttr: true }),
    }));

    // Create a base lattice with props stores
    interface BaseState {
      value: number;
    }

    const { api: baseAPI } = createAPI<BaseState>(() => ({
      value: 0,
    }));

    const baseLattice = createLattice<BaseState>('base', {
      api: baseAPI,
      props: mergeProps(baseButtonProps, baseInputProps),
    });

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware({
      props: mergeProps(configButtonProps, configSelectProps),
    });

    // Create a composed lattice
    const composedLattice = createLattice('composed', result);

    // Verify that props are properly merged using partName metadata
    expect(composedLattice.props).toBeDefined();

    // The result should have all three unique props (button, input, select)
    expect(Object.keys(composedLattice.props).sort()).toEqual(
      ['button', 'input', 'select'].sort()
    );

    // For shared partNames (button), the merged props should be used
    // Note: With real implementation, it's more complex than just using configProps

    // Verify that we can access the props correctly
    const buttonProps = composedLattice.props.button?.getState().get({});
    const inputProps = composedLattice.props.input?.getState().get({});
    const selectProps = composedLattice.props.select?.getState().get({});

    expect(buttonProps?.configAttr).toBe(true); // Config should override
    expect(inputProps?.baseInputAttr).toBe(true);
    expect(selectProps?.configSelectAttr).toBe(true);
  });
});

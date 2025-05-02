import { describe, it, expect, vi } from 'vitest';
import { withLattice, mergeProps, createProps } from '../index';
import { Lattice, LatticeAPI, LatticeHooks } from '../types';

describe('withLattice', () => {
  it('should merge API objects from base lattice and config', () => {
    interface BaseState extends Record<string, unknown> {
      baseMethod: () => string;
      sharedMethod: () => string;
    }

    interface ConfigState extends Record<string, unknown> {
      configMethod: () => string;
      sharedMethod: () => string;
    }

    // Create a mock base lattice
    const baseLattice: Lattice = {
      name: 'base',
      api: {
        getState: () =>
          ({
            baseMethod: () => 'base',
            sharedMethod: () => 'base-shared',
          }) as BaseState,
      } as unknown as LatticeAPI,
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      } as LatticeHooks,
      props: {
        button: createProps('button', () => ({
          get: () => ({ base: true }),
        })),
      },
      use: vi.fn(),
    };

    // Create a config to merge with the base
    const config = {
      api: {
        getState: () =>
          ({
            configMethod: () => 'config',
            sharedMethod: () => 'config-shared',
          }) as ConfigState,
      } as unknown as LatticeAPI,
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that the API objects are properly merged
    expect(result.api).toBeDefined();
    const state = result.api.getState() as unknown as BaseState & ConfigState;
    expect(state.baseMethod()).toBe('base');
    expect(state.configMethod()).toBe('config');
    expect(state.sharedMethod()).toBe('config-shared'); // Config overrides base
  });

  it('should merge hooks from base lattice and config', () => {
    // Create a mock base lattice with hooks
    const baseLattice: Lattice = {
      name: 'base',
      api: { getState: () => ({}) } as LatticeAPI,
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      } as LatticeHooks,
      props: {},
      use: vi.fn(),
    };

    // Create a config with hooks
    const config = {
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      } as LatticeHooks,
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that hooks are properly merged
    expect(result.hooks).toBeDefined();
    expect(result.hooks.before).toBe(config.hooks.before); // Config hooks override base hooks
    expect(result.hooks.after).toBe(config.hooks.after);
  });

  it('should merge props objects with special merge logic', () => {
    // Define props objects
    const baseProps = createProps('button', () => ({
      get: () => ({ base: true }),
    }));
    const configProps = createProps('button', () => ({
      get: () => ({ config: true }),
    }));

    // Create a mock base lattice with props
    const baseLattice: Lattice = {
      name: 'base',
      api: { getState: () => ({}) } as LatticeAPI,
      hooks: {} as LatticeHooks,
      props: {
        button: baseProps,
        input: createProps('input', () => ({
          get: () => ({ baseInput: true }),
        })),
      },
      use: vi.fn(),
    };

    // Create a config with props
    const config = {
      props: {
        button: configProps,
        select: createProps('select', () => ({
          get: () => ({ select: true }),
        })),
      },
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that props are properly merged
    expect(result.props).toBeDefined();

    // Since we're using the actual mergeProps function, the result should be what mergeProps returns
    // when applied to the base and config props
    expect(result.props.button).toEqual(
      mergeProps(baseProps, configProps).button
    );
    expect(result.props.input).toEqual(baseLattice.props.input);
    expect(result.props.select).toEqual(config.props.select);
  });

  it('should preserve the use method from base lattice', () => {
    // Create a mock base lattice with a use method
    const baseLattice: Lattice = {
      name: 'base',
      api: { getState: () => ({}) } as LatticeAPI,
      hooks: {} as LatticeHooks,
      props: {},
      use: vi.fn(),
    };

    // Create a simple config
    const config = {};

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that the use method is preserved
    expect(result.use).toBe(baseLattice.use);
  });

  it('should correctly handle props stores with partName metadata', () => {
    // Create actual props stores with partName metadata using createProps
    const baseButtonProps = createProps('button', () => ({
      get: () => ({ role: 'button', baseAttr: true }),
    }));

    const baseInputProps = createProps('input', () => ({
      get: () => ({ role: 'textbox', baseInputAttr: true }),
    }));

    const configButtonProps = createProps('button', () => ({
      get: () => ({ type: 'submit', configAttr: true }),
    }));

    const configSelectProps = createProps('select', () => ({
      get: () => ({ role: 'listbox', configSelectAttr: true }),
    }));

    // Create a mock base lattice with props stores
    const baseLattice: Lattice = {
      name: 'base',
      api: { getState: () => ({}) } as LatticeAPI,
      hooks: {} as LatticeHooks,
      props: mergeProps(baseButtonProps, baseInputProps),
      use: vi.fn(),
    };

    // Create a config with props stores
    const config = {
      props: mergeProps(configButtonProps, configSelectProps),
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that props are properly merged using partName metadata
    expect(result.props).toBeDefined();

    // The result should have all three unique props (button, input, select)
    expect(Object.keys(result.props).sort()).toEqual(
      ['button', 'input', 'select'].sort()
    );

    // For shared partNames (button), config props should be used
    expect(result.props.button).toBe(configButtonProps);

    // Unique partNames from base lattice should be preserved
    expect(result.props.input).toBe(baseInputProps);

    // Unique partNames from config should be added
    expect(result.props.select).toBe(configSelectProps);

    // Verify that we can access the props correctly
    const buttonProps = result.props.button?.getState().get({});
    const inputProps = result.props.input?.getState().get({});
    const selectProps = result.props.select?.getState().get({});

    expect(buttonProps?.configAttr).toBe(true);
    expect(inputProps?.baseInputAttr).toBe(true);
    expect(selectProps?.configSelectAttr).toBe(true);
  });
});

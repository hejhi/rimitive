import { describe, it, expect, vi } from 'vitest';
import { withLattice, mergeProps, createProps } from '../index';

describe('withLattice', () => {
  it('should merge API objects from base lattice and config', () => {
    // Create a mock base lattice
    const baseLattice = {
      api: {
        getState: () => ({
          baseMethod: () => 'base',
          sharedMethod: () => 'base-shared',
        }),
      },
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      },
      props: {
        button: {
          get: () => ({ base: true }),
        },
      },
      use: vi.fn(),
    };

    // Create a config to merge with the base
    const config = {
      api: {
        getState: () => ({
          configMethod: () => 'config',
          sharedMethod: () => 'config-shared',
        }),
      },
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that the API objects are properly merged
    expect(result.api).toBeDefined();
    expect(result.api.getState().baseMethod()).toBe('base');
    expect(result.api.getState().configMethod()).toBe('config');
    expect(result.api.getState().sharedMethod()).toBe('config-shared'); // Config overrides base
  });

  it('should merge hooks from base lattice and config', () => {
    // Create a mock base lattice with hooks
    const baseLattice = {
      api: { getState: () => ({}) },
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      },
      props: {},
      use: vi.fn(),
    };

    // Create a config with hooks
    const config = {
      hooks: {
        before: vi.fn(),
        after: vi.fn(),
      },
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
    const baseProps = { get: () => ({ base: true }) };
    const configProps = { get: () => ({ config: true }) };

    // Create a mock base lattice with props
    const baseLattice = {
      api: { getState: () => ({}) },
      hooks: {},
      props: {
        button: baseProps,
        input: { get: () => ({ baseInput: true }) },
      },
      use: vi.fn(),
    };

    // Create a config with props
    const config = {
      props: {
        button: configProps,
        select: { get: () => ({ select: true }) },
      },
    };

    // Apply the withLattice middleware
    const middleware = withLattice(baseLattice);
    const result = middleware(config);

    // Verify that props are properly merged
    expect(result.props).toBeDefined();

    // Since we're using the actual mergeProps function, the result should be what mergeProps returns
    // when applied to the base and config props
    expect(result.props.button).toEqual(mergeProps([baseProps, configProps]));
    expect(result.props.input).toEqual(baseLattice.props.input);
    expect(result.props.select).toEqual(config.props.select);
  });

  it('should preserve the use method from base lattice', () => {
    // Create a mock base lattice with a use method
    const baseLattice = {
      api: { getState: () => ({}) },
      hooks: {},
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
    const baseLattice = {
      api: { getState: () => ({}) },
      hooks: {},
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
    expect(result.props.button.getState().get().configAttr).toBe(true);
    expect(result.props.input.getState().get().baseInputAttr).toBe(true);
    expect(result.props.select.getState().get().configSelectAttr).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createLattice } from '../lattice';
import {
  ReactiveApi,
  HookSystem,
  PropsSystem,
  CreateLatticeOptions,
} from '../types';

describe('createLattice', () => {
  it('should create a lattice with the provided namespace, API, hooks, and props', () => {
    // Setup mock API
    const mockApi: ReactiveApi = {
      use: {
        getValue: () => 'test' as any,
        setValue: () => (() => {}) as any,
      },
      getValue: () => 'test',
      setValue: () => {},
    };

    // Setup mock hooks system
    const mockHooks: HookSystem = {
      before: vi.fn().mockReturnThis(),
      after: vi.fn().mockReturnThis(),
    };

    // Setup mock props system
    const mockProps: PropsSystem = {
      root: vi.fn() as any,
    };

    // Create options object
    const options: CreateLatticeOptions = {
      api: mockApi,
      hooks: mockHooks,
      props: mockProps,
    };

    // Act: Call createLattice function with namespace and options
    const lattice = createLattice('test', options);

    // Assert: Verify lattice structure
    expect(lattice).toBeDefined();
    expect(lattice.api).toBe(mockApi);
    expect(lattice.hooks).toBe(mockHooks);
    expect(lattice.props).toBe(mockProps);

    // Assert: Verify lattice has use method
    expect(typeof lattice.use).toBe('function');
  });

  it('should allow plugins to be applied via the use method', () => {
    // Setup mock API, hooks, and props
    const mockApi: ReactiveApi = {
      use: {},
    };
    const mockHooks: HookSystem = {
      before: vi.fn().mockReturnThis(),
      after: vi.fn().mockReturnThis(),
    };
    const mockProps: PropsSystem = {};

    // Create options
    const options: CreateLatticeOptions = {
      api: mockApi,
      hooks: mockHooks,
      props: mockProps,
    };

    // Create a mock plugin function
    const mockPlugin = vi.fn().mockImplementation((baseLattice) => baseLattice);

    // Act: Create lattice and apply plugin
    const lattice = createLattice('test', options);
    const result = lattice.use(mockPlugin);

    // Assert: Verify plugin was called with the lattice
    expect(mockPlugin).toHaveBeenCalledWith(lattice);

    // Assert: Verify use returns the result of the plugin
    expect(result).toBe(lattice);
  });
});

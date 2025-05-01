import { describe, it, expect, vi } from 'vitest';
import { createLattice } from '../index';

describe('createLattice', () => {
  it('should create a lattice with the given name and empty configuration', () => {
    const lattice = createLattice('test');

    expect(lattice).toBeDefined();
    expect(lattice.name).toBe('test');
    expect(lattice.api).toEqual({});
    expect(lattice.hooks).toEqual({});
    expect(lattice.props).toEqual({});
    expect(typeof lattice.use).toBe('function');
  });

  it('should create a lattice with the given name and full configuration', () => {
    const mockApi = { getState: vi.fn() };
    const mockHooks = { before: vi.fn(), after: vi.fn() };
    const mockProps = {
      button: { get: vi.fn() },
      input: { get: vi.fn() },
    };
    const mockUse = vi.fn();

    const config = {
      api: mockApi,
      hooks: mockHooks,
      props: mockProps,
      use: mockUse,
    };

    const lattice = createLattice('test', config);

    expect(lattice).toBeDefined();
    expect(lattice.name).toBe('test');
    expect(lattice.api).toBe(mockApi);
    expect(lattice.hooks).toBe(mockHooks);
    expect(lattice.props).toBe(mockProps);
    expect(lattice.use).toBe(mockUse);
  });

  it('should provide a default use function if not provided', () => {
    const lattice = createLattice('test');

    expect(typeof lattice.use).toBe('function');

    // Test the default use function
    const mockPlugin = vi.fn((baseLattice) => ({
      ...baseLattice,
      extended: true,
    }));

    const enhancedLattice = lattice.use(mockPlugin);

    expect(mockPlugin).toHaveBeenCalledWith(lattice);
    expect(enhancedLattice.extended).toBe(true);
    expect(enhancedLattice.name).toBe('test');
  });
});

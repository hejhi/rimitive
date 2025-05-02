import { describe, it, expect, vi } from 'vitest';
import { createLattice } from '../index';
import { StoreApi } from 'zustand';
import { PropsState } from '../types';

describe('createLattice', () => {
  it('should create a lattice with the given name and empty configuration', () => {
    const lattice = createLattice('test');

    expect(lattice).toBeDefined();
    expect(lattice.name).toBe('test');
    expect(typeof lattice.use).toBe('function');
  });

  it('should create a lattice with the given name and full configuration', () => {
    const mockApi = { getState: vi.fn() };
    const mockHooks = { before: vi.fn(), after: vi.fn() };

    // Create proper mock stores that match PropsStore type
    const createMockStore = (
      name: string
    ): StoreApi<PropsState> & { partName: string } => ({
      getState: vi.fn(() => ({ partName: name, get: vi.fn() })),
      setState: vi.fn(),
      subscribe: vi.fn(),
      getInitialState: vi.fn(),
      partName: name,
    });

    const mockProps = {
      button: createMockStore('button'),
      input: createMockStore('input'),
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

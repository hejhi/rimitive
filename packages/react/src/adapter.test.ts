import { describe, it, expect } from 'vitest';
import type { LatticeAPI } from '@lattice/core';
import { createReactAdapter } from './adapter';

describe('createReactAdapter', () => {
  it('should consume LatticeAPI and return React hooks interface', () => {
    // Arrange: Create a mock LatticeAPI (the standardized interface from any store adapter)
    const mockLatticeAPI: LatticeAPI<any, any, any> = {
      getSelectors: () => ({ count: 0 }),
      getActions: () => ({ increment: () => {} }),
      getViews: () => ({}),
      subscribe: () => {
        // Return unsubscribe function
        return () => {};
      },
      destroy: () => {},
    };

    // Act: Create React adapter from the LatticeAPI
    const reactAdapter = createReactAdapter(mockLatticeAPI);

    // Assert: Verify the adapter returns the required React hooks interface
    expect(reactAdapter).toHaveProperty('useSelectors');
    expect(reactAdapter).toHaveProperty('useActions');
    expect(typeof reactAdapter.useSelectors).toBe('function');
    expect(typeof reactAdapter.useActions).toBe('function');
  });

  it('useActions should return actions from LatticeAPI', () => {
    // Arrange: Mock actions that the store adapter provides
    const mockActions = {
      increment: () => {},
      decrement: () => {},
    };
    
    const mockLatticeAPI: LatticeAPI<any, typeof mockActions, any> = {
      getSelectors: () => ({}),
      getActions: () => mockActions,
      getViews: () => ({}),
      subscribe: () => () => {},
      destroy: () => {},
    };

    // Act: Create adapter and call useActions
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const actions = reactAdapter.useActions();

    // Assert: Verify useActions returns the exact actions from the LatticeAPI
    expect(actions).toBe(mockActions);
  });

  it('useSelectors should return selected values from LatticeAPI', () => {
    // Arrange: Mock selectors that the store adapter provides
    const mockSelectors = {
      count: 5,
      doubled: 10,
    };
    
    const mockLatticeAPI: LatticeAPI<typeof mockSelectors, any, any> = {
      getSelectors: () => mockSelectors,
      getActions: () => ({}),
      getViews: () => ({}),
      subscribe: () => () => {},
      destroy: () => {},
    };

    // Act: Create adapter and use selector
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    // Select a specific value using a selector function
    const count = reactAdapter.useSelectors((selectors) => selectors.count);

    // Assert: Verify useSelectors returns the selected value
    expect(count).toBe(5);
  });

  it('useSelectors should support selecting multiple values', () => {
    // Arrange: Mock selectors
    const mockSelectors = {
      count: 5,
      doubled: 10,
      name: 'test',
    };
    
    const mockLatticeAPI: LatticeAPI<typeof mockSelectors, any, any> = {
      getSelectors: () => mockSelectors,
      getActions: () => ({}),
      getViews: () => ({}),
      subscribe: () => () => {},
      destroy: () => {},
    };

    // Act: Select multiple values
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const selected = reactAdapter.useSelectors((selectors) => ({
      count: selectors.count,
      name: selectors.name,
    }));

    // Assert: Verify the selected object
    expect(selected).toEqual({ count: 5, name: 'test' });
  });
});
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

    // Act: Create adapter and call useActions within a React component
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const { result } = renderHook(() => reactAdapter.useActions());

    // Assert: Verify useActions returns the exact actions from the LatticeAPI
    expect(result.current).toBe(mockActions);
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

    // Act: Create adapter and use selector within a React component
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const { result } = renderHook(() => 
      reactAdapter.useSelectors((selectors) => selectors.count)
    );

    // Assert: Verify useSelectors returns the selected value
    expect(result.current).toBe(5);
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

    // Act: Select multiple values within a React component
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const { result } = renderHook(() => 
      reactAdapter.useSelectors((selectors) => ({
        count: selectors.count,
        name: selectors.name,
      }))
    );

    // Assert: Verify the selected object
    expect(result.current).toEqual({ count: 5, name: 'test' });
  });

  it('useSelectors should re-render when subscribed state changes', () => {
    // Arrange: Create a mock store with subscription capability
    let currentSelectors = { count: 0 };
    const subscribers = new Set<() => void>();
    
    const mockLatticeAPI: LatticeAPI<typeof currentSelectors, any, any> = {
      getSelectors: () => currentSelectors,
      getActions: () => ({}),
      getViews: () => ({}),
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
      destroy: () => {},
    };

    // Act: Render the hook
    const reactAdapter = createReactAdapter(mockLatticeAPI);
    const { result } = renderHook(() => 
      reactAdapter.useSelectors((selectors) => selectors.count)
    );

    // Assert: Initial value
    expect(result.current).toBe(0);

    // Act: Update the store and notify subscribers
    act(() => {
      currentSelectors = { count: 5 };
      subscribers.forEach(callback => callback());
    });

    // Assert: Hook returns updated value
    expect(result.current).toBe(5);
  });
});
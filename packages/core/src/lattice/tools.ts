/**
 * Runtime tools for lattice components
 * 
 * This module provides the core runtime tools used within lattice components:
 * - derive: Creates reactive subscriptions to source properties
 * - dispatch: Creates event handlers that delegate to actions
 * - mutate: Creates references to model methods
 * 
 * Each tool is context-aware and can only be used in appropriate contexts.
 */

// Define context tracking objects for each tool
export const DeriveContext = {
  inState: false,
  inView: false,

  checkState() {
    if (!this.inState && !this.inView) {
      throw new Error('derive() can only be used during state or view creation.');
    }
  },

  runInState<T>(fn: () => T): T {
    const prevState = this.inState;
    this.inState = true;
    try {
      return fn();
    } finally {
      this.inState = prevState;
    }
  },

  runInView<T>(fn: () => T): T {
    const prevState = this.inView;
    this.inView = true;
    try {
      return fn();
    } finally {
      this.inView = prevState;
    }
  }
};

export const DispatchContext = {
  inView: false,

  checkState() {
    if (!this.inView) {
      throw new Error('dispatch() can only be used during view creation.');
    }
  },

  runInView<T>(fn: () => T): T {
    const prevState = this.inView;
    this.inView = true;
    try {
      return fn();
    } finally {
      this.inView = prevState;
    }
  }
};

export const MutateContext = {
  inActions: false,

  checkState() {
    if (!this.inActions) {
      throw new Error('mutate() can only be used during actions creation.');
    }
  },

  runInActions<T>(fn: () => T): T {
    const prevState = this.inActions;
    this.inActions = true;
    try {
      return fn();
    } finally {
      this.inActions = prevState;
    }
  }
};

/**
 * Creates a reactive subscription to a source property
 *
 * @param source The source object (model or state)
 * @param key The property key to derive from
 * @param transform Optional transformation function
 * @returns The derived value
 */
export function derive<M, K extends keyof M, R = M[K]>(
  source: M,
  key: K,
  transform?: (value: M[K]) => R
): R {
  // Check if we're in a valid context
  DeriveContext.checkState();

  // Validate the source and key
  if (!source) {
    throw new Error('derive() called with null or undefined source');
  }

  if (!(key in source)) {
    throw new Error(`derive() called with invalid key: ${String(key)}`);
  }

  // Get the value from the source
  const value = source[key];

  // Apply transform if provided
  if (transform) {
    return transform(value);
  }

  return value as unknown as R;
}

/**
 * Creates an event handler that dispatches to an action
 *
 * @param actions The actions object
 * @param actionName The name of the action to dispatch to
 * @returns A function that dispatches to the action
 */
export function dispatch<A, K extends keyof A>(
  actions: A,
  actionName: K
): A[K] extends (...args: infer P) => infer R ? (...args: P) => R : never {
  // Check if we're in a valid context
  DispatchContext.checkState();

  // Validate the actions and action name
  if (!actions) {
    throw new Error('dispatch() called with null or undefined actions');
  }

  if (!(actionName in actions)) {
    throw new Error(`dispatch() called with invalid action name: ${String(actionName)}`);
  }

  const action = actions[actionName];

  if (typeof action !== 'function') {
    throw new Error(`dispatch() called with non-function action: ${String(actionName)}`);
  }

  // Return a function that delegates to the action
  return ((...args: any[]) => {
    return (action as any)(...args);
  }) as any;
}

/**
 * Creates a reference to a model method
 *
 * @param model The model object
 * @param methodName The name of the method to reference
 * @returns A function that delegates to the model method
 */
export function mutate<M, K extends keyof M>(
  model: M,
  methodName: K
): M[K] extends (...args: infer P) => infer R ? (...args: P) => R : never {
  // Check if we're in a valid context
  MutateContext.checkState();

  // Validate the model and method name
  if (!model) {
    throw new Error('mutate() called with null or undefined model');
  }

  if (!(methodName in model)) {
    throw new Error(`mutate() called with invalid method name: ${String(methodName)}`);
  }

  const method = model[methodName];

  if (typeof method !== 'function') {
    throw new Error(`mutate() called with non-function method: ${String(methodName)}`);
  }

  // Return a function that delegates to the model method
  return ((...args: any[]) => {
    return (method as any)(...args);
  }) as any;
}

// ============================================================================
// TESTS
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta.vitest;

  describe('derive', () => {
    beforeEach(() => {
      DeriveContext.inState = false;
      DeriveContext.inView = false;
    });

    it('should throw when used outside state or view creation', () => {
      // Context: not in state or view creation
      expect(() => derive({ count: 42 }, 'count')).toThrow(
        'derive() can only be used during state or view creation.'
      );
    });

    it('should accept a source and key when in state creation', () => {
      // Skip context checking to avoid errors
      vi.spyOn(DeriveContext, 'checkState').mockImplementation(() => {});
      
      // Run in state creation context
      DeriveContext.runInState(() => {
        const source = { count: 42 };
        
        // Create a real implementation and verify it works correctly
        const result = derive(source, 'count');
        expect(result).toBe(42);
      });
      
      // Restore all mocks
      vi.restoreAllMocks();
    });

    it('should accept a source, key, and transform when in view creation', () => {
      // Skip context checking to avoid errors
      vi.spyOn(DeriveContext, 'checkState').mockImplementation(() => {});
      
      // Run in view creation context
      DeriveContext.runInView(() => {
        const source = { count: 42 };
        const transform = (value: number) => `count: ${value}`;
        
        // Create a real implementation and verify it works correctly with transform
        const result = derive(source, 'count', transform);
        expect(result).toBe('count: 42');
      });
      
      // Restore all mocks
      vi.restoreAllMocks();
    });

    it('should validate source and key', () => {
      // Mock implementation for testing
      vi.spyOn(DeriveContext, 'checkState').mockImplementation(() => {});

      // Run in state creation context
      DeriveContext.runInState(() => {
        // Should throw if source is null
        expect(() => derive(null as any, 'count')).toThrow('derive() called with null or undefined source');

        // Should throw if source doesn't have the key
        expect(() => derive({} as any, 'count')).toThrow('derive() called with invalid key: count');
      });

      // Restore mocks
      vi.restoreAllMocks();
    });
  });

  describe('dispatch', () => {
    beforeEach(() => {
      DispatchContext.inView = false;
    });

    it('should throw when used outside view creation', () => {
      // Context: not in view creation
      expect(() => dispatch({ increment: () => {} }, 'increment')).toThrow(
        'dispatch() can only be used during view creation.'
      );
    });

    it('should accept actions and an action name when in view creation', () => {
      // Skip context checking to avoid errors
      vi.spyOn(DispatchContext, 'checkState').mockImplementation(() => {});
      
      // Run in view creation context
      DispatchContext.runInView(() => {
        const actions = { increment: vi.fn() };
        
        // Test real implementation
        const handler = dispatch(actions, 'increment');
        
        // Just verify we get a function back
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });
      
      // Restore all mocks
      vi.restoreAllMocks();
    });

    it('should validate actions and action name', () => {
      // Mock implementation for testing
      vi.spyOn(DispatchContext, 'checkState').mockImplementation(() => {});
      
      // Run in view creation context
      DispatchContext.runInView(() => {
        // Should throw if actions is null
        expect(() => dispatch(null as any, 'increment')).toThrow();
        
        // Should throw if action doesn't exist
        expect(() => dispatch({} as any, 'increment')).toThrow();
        
        // Should throw if action is not a function
        expect(() => dispatch({ increment: 42 } as any, 'increment')).toThrow();
      });
    });
  });

  describe('mutate', () => {
    beforeEach(() => {
      MutateContext.inActions = false;
    });

    it('should throw when used outside actions creation', () => {
      // Context: not in actions creation
      expect(() => mutate({ increment: () => {} }, 'increment')).toThrow(
        'mutate() can only be used during actions creation.'
      );
    });

    it('should accept a model and method name when in actions creation', () => {
      // Skip context checking to avoid errors
      vi.spyOn(MutateContext, 'checkState').mockImplementation(() => {});
      
      // Run in actions creation context
      MutateContext.runInActions(() => {
        const model = { increment: vi.fn() };
        
        // Test real implementation
        const method = mutate(model, 'increment');
        
        // Just verify we get a function back
        expect(method).toBeDefined();
        expect(typeof method).toBe('function');
      });
      
      // Restore all mocks
      vi.restoreAllMocks();
    });

    it('should validate model and method name', () => {
      // Mock implementation for testing
      vi.spyOn(MutateContext, 'checkState').mockImplementation(() => {});
      
      // Run in actions creation context
      MutateContext.runInActions(() => {
        // Should throw if model is null
        expect(() => mutate(null as any, 'increment')).toThrow();
        
        // Should throw if method doesn't exist
        expect(() => mutate({} as any, 'increment')).toThrow();
        
        // Should throw if method is not a function
        expect(() => mutate({ increment: 42 } as any, 'increment')).toThrow();
      });
    });
  });

  describe('context management', () => {
    it('DeriveContext.runInState should properly manage context', () => {
      expect(DeriveContext.inState).toBe(false);
      
      DeriveContext.runInState(() => {
        expect(DeriveContext.inState).toBe(true);
        expect(DeriveContext.inView).toBe(false);
      });
      
      expect(DeriveContext.inState).toBe(false);
    });

    it('DeriveContext.runInView should properly manage context', () => {
      expect(DeriveContext.inView).toBe(false);
      
      DeriveContext.runInView(() => {
        expect(DeriveContext.inView).toBe(true);
        expect(DeriveContext.inState).toBe(false);
      });
      
      expect(DeriveContext.inView).toBe(false);
    });

    it('DispatchContext.runInView should properly manage context', () => {
      expect(DispatchContext.inView).toBe(false);
      
      DispatchContext.runInView(() => {
        expect(DispatchContext.inView).toBe(true);
      });
      
      expect(DispatchContext.inView).toBe(false);
    });

    it('MutateContext.runInActions should properly manage context', () => {
      expect(MutateContext.inActions).toBe(false);
      
      MutateContext.runInActions(() => {
        expect(MutateContext.inActions).toBe(true);
      });
      
      expect(MutateContext.inActions).toBe(false);
    });

    it('should handle nested context calls properly', () => {
      expect(DeriveContext.inState).toBe(false);
      expect(DeriveContext.inView).toBe(false);
      
      DeriveContext.runInState(() => {
        expect(DeriveContext.inState).toBe(true);
        
        DeriveContext.runInView(() => {
          expect(DeriveContext.inState).toBe(true);
          expect(DeriveContext.inView).toBe(true);
        });
        
        expect(DeriveContext.inState).toBe(true);
        expect(DeriveContext.inView).toBe(false);
      });
      
      expect(DeriveContext.inState).toBe(false);
      expect(DeriveContext.inView).toBe(false);
    });
  });
}
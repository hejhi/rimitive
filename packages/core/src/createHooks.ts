import { HooksSystem } from './types';

/**
 * Creates a hooks system for intercepting API method calls
 *
 * The hooks system provides a powerful way to intercept and modify the behavior of API methods
 * without modifying their implementation. It allows for:
 *
 * 1. Registering 'before' hooks that run before method execution and can modify arguments
 * 2. Registering 'after' hooks that run after method execution and can modify return values
 * 3. Removing previously registered hooks
 * 4. Executing hooks in registration order with proper argument and result handling
 *
 * @returns A complete hooks system implementation with before/after registration and execution methods
 */
export function createHooks(): HooksSystem {
  const beforeHooks: Record<string, Function[]> = {};
  const afterHooks: Record<string, Function[]> = {};

  return {
    /**
     * Register a hook to run before a method is executed
     *
     * @param method The name of the method to hook into
     * @param callback The function to call before the method executes
     */
    before: (method: string, callback: Function) => {
      if (!beforeHooks[method]) {
        beforeHooks[method] = [];
      }
      beforeHooks[method].push(callback);
    },

    /**
     * Register a hook to run after a method is executed
     *
     * @param method The name of the method to hook into
     * @param callback The function to call after the method executes
     */
    after: (method: string, callback: Function) => {
      if (!afterHooks[method]) {
        afterHooks[method] = [];
      }
      afterHooks[method].push(callback);
    },

    /**
     * Remove a previously registered hook
     *
     * @param type Whether to remove a 'before' or 'after' hook
     * @param method The method name the hook was registered for
     * @param callback The callback function to remove
     */
    remove: (type: 'before' | 'after', method: string, callback: Function) => {
      const hooksCollection = type === 'before' ? beforeHooks : afterHooks;
      if (hooksCollection[method]) {
        const index = hooksCollection[method].indexOf(callback);
        if (index !== -1) {
          hooksCollection[method].splice(index, 1);
        }
      }
    },

    /**
     * Execute all 'before' hooks registered for a method
     *
     * This runs all hooks in registration order. Each hook receives
     * the original arguments. If a hook returns a non-undefined value,
     * it will be used as the result of the hook execution.
     *
     * @param method The method name to execute hooks for
     * @param args Arguments to pass to the hooks
     * @returns The potentially modified first argument
     */
    executeBefore: (method: string, ...args: any[]) => {
      if (!beforeHooks[method]) {
        return args.length > 0 ? args[0] : undefined;
      }

      let result = args.length > 0 ? args[0] : undefined;

      // Execute all hooks, passing original arguments
      for (const hook of beforeHooks[method]) {
        try {
          const hookResult = hook(...args);
          // Store the result from the hook if it returns something
          if (hookResult !== undefined) {
            result = hookResult;
          }
        } catch (error) {
          throw error;
        }
      }

      return result;
    },

    /**
     * Execute all 'after' hooks registered for a method
     *
     * This runs all hooks in registration order. Each hook receives
     * the result from the method and the original arguments. If a hook
     * returns a non-undefined value, it will be used as the new result.
     *
     * @param method The method name to execute hooks for
     * @param result The result from the method execution
     * @param args Original arguments passed to the method
     * @returns The potentially modified result
     */
    executeAfter: (method: string, result: any, ...args: any[]) => {
      if (!afterHooks[method]) {
        return result;
      }

      let modifiedResult = result;

      // Execute all hooks, passing original result and arguments
      for (const hook of afterHooks[method]) {
        try {
          const hookResult = hook(modifiedResult, ...args);
          // Store the result from the hook if it returns something
          if (hookResult !== undefined) {
            modifiedResult = hookResult;
          }
        } catch (error) {
          throw error;
        }
      }

      return modifiedResult;
    },

    _beforeHooks: beforeHooks,
    _afterHooks: afterHooks,
  };
}

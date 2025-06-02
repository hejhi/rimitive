/**
 * @fileoverview Compose utility for createSlice dependency injection
 *
 * Provides a clean way to compose slices with explicit dependencies,
 * eliminating the need for select() markers and recursive resolution.
 *
 * This implementation uses a purely functional approach with multiple
 * function layers to encode composition data.
 */

import type { SliceFactory } from './index';

/**
 * Type for resolved dependencies
 */
type ResolveDeps<Deps extends Record<string, SliceFactory<any, any>>> = {
  [K in keyof Deps]: Deps[K] extends SliceFactory<any, infer T> ? T : never;
};

/**
 * Compose function for dependency injection in createSlice
 *
 * @param deps - Object mapping dependency names to slice factories
 * @param selector - Function that receives model and resolved dependencies
 * @returns A regular selector function that resolves dependencies internally
 *
 * @example
 * ```typescript
 * const actions = createSlice(model, (m) => ({
 *   increment: m.increment,
 *   decrement: m.decrement
 * }));
 *
 * const userSlice = createSlice(model, (m) => ({
 *   name: m.user.name,
 *   email: m.user.email
 * }));
 *
 * // Compose with dependencies
 * const buttonSlice = createSlice(
 *   model,
 *   compose(
 *     { actions, userSlice },
 *     (m, { actions, userSlice }) => ({
 *       onClick: actions.increment,
 *       userName: userSlice.name,
 *       disabled: m.disabled
 *     })
 *   )
 * );
 * ```
 */
export function compose<
  Model,
  Deps extends Record<string, SliceFactory<Model, unknown>>,
  Result,
>(
  deps: Deps,
  selector: (model: Model, resolvedDeps: ResolveDeps<Deps>) => Result
): (model: Model) => Result {
  // Return a regular selector function that resolves dependencies
  return (model: Model): Result => {
    // Build resolved dependencies using Object.fromEntries for type safety
    const entries = Object.entries(deps).map(([key, sliceFactory]) => [
      key,
      sliceFactory(model),
    ]);
    const resolvedDeps = Object.fromEntries(entries) as ResolveDeps<Deps>;

    // Call the selector with model and resolved dependencies
    return selector(model, resolvedDeps);
  };
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice } = await import('./index');

  describe('compose', () => {
    it('should create a selector that resolves dependencies', () => {
      const model = createModel<{ count: number }>(() => ({ count: 0 }));
      const slice = createSlice(model, (m: { count: number }) => ({
        value: m.count,
      }));

      const composedSelector = compose({ mySlice: slice }, (_, deps) => ({
        doubled: deps.mySlice.value * 2,
      }));

      // Should be a regular function
      expect(typeof composedSelector).toBe('function');

      // When called with model, returns the result directly
      const modelData = { count: 5 };
      const result = composedSelector(modelData);
      expect(result).toEqual({ doubled: 10 });
    });

    it('should work with multiple dependencies', () => {
      const model = createModel<{ x: number; y: number }>(() => ({
        x: 0,
        y: 0,
      }));
      const xSlice = createSlice(model, (m: { x: number; y: number }) => ({
        value: m.x,
      }));
      const ySlice = createSlice(model, (m: { x: number; y: number }) => ({
        value: m.y,
      }));

      const composedSelector = compose({ x: xSlice, y: ySlice }, (_, deps) => ({
        sum: deps.x.value + deps.y.value,
      }));

      // When called with model, resolves dependencies and returns result
      const result = composedSelector({ x: 3, y: 4 });
      expect(result).toEqual({ sum: 7 });
    });

    it('should compose slices with dependencies', () => {
      const model = createModel<{
        count: number;
        increment: () => void;
        user: { name: string; email: string };
      }>(() => ({
        count: 0,
        increment: () => {},
        user: { name: 'Alice', email: 'alice@example.com' },
      }));

      const actions = createSlice(
        model,
        (m: {
          count: number;
          increment: () => void;
          user: { name: string; email: string };
        }) => ({
          increment: m.increment,
        })
      );

      const userSlice = createSlice(
        model,
        (m: {
          count: number;
          increment: () => void;
          user: { name: string; email: string };
        }) => ({
          name: m.user.name,
          email: m.user.email,
        })
      );

      const composed = createSlice(
        model,
        compose({ actions, userSlice }, (m, { actions, userSlice }) => ({
          onClick: actions.increment,
          userName: userSlice.name,
          count: m.count,
        }))
      );

      const modelData = {
        count: 5,
        increment: () => {},
        user: { name: 'Bob', email: 'bob@example.com' },
      };

      const result = composed(modelData);

      // Now compose returns a regular selector, so result is the actual object
      expect(result).toEqual({
        onClick: modelData.increment,
        userName: 'Bob',
        count: 5,
      });
    });

    it('should handle multiple dependencies', () => {
      const model = createModel<{
        x: number;
        y: number;
        z: number;
        colors: { primary: string; secondary: string };
        sizes: { width: number; height: number };
      }>(() => ({
        x: 0,
        y: 0,
        z: 0,
        colors: { primary: 'blue', secondary: 'red' },
        sizes: { width: 100, height: 200 },
      }));

      const positionSlice = createSlice(
        model,
        (m: {
          x: number;
          y: number;
          z: number;
          colors: { primary: string; secondary: string };
          sizes: { width: number; height: number };
        }) => ({
          x: m.x,
          y: m.y,
          z: m.z,
        })
      );

      const colorSlice = createSlice(
        model,
        (m: {
          x: number;
          y: number;
          z: number;
          colors: { primary: string; secondary: string };
          sizes: { width: number; height: number };
        }) => m.colors
      );
      const sizeSlice = createSlice(
        model,
        (m: {
          x: number;
          y: number;
          z: number;
          colors: { primary: string; secondary: string };
          sizes: { width: number; height: number };
        }) => m.sizes
      );

      const viewSlice = createSlice(
        model,
        compose(
          { position: positionSlice, colors: colorSlice, sizes: sizeSlice },
          (_, { position, colors, sizes }) => ({
            transform: `translate3d(${position.x}px, ${position.y}px, ${position.z}px)`,
            backgroundColor: colors.primary,
            borderColor: colors.secondary,
            width: sizes.width,
            height: sizes.height,
          })
        )
      );

      const modelData = {
        x: 10,
        y: 20,
        z: 30,
        colors: { primary: 'green', secondary: 'yellow' },
        sizes: { width: 300, height: 400 },
      };

      const result = viewSlice(modelData);

      // Compose now returns a regular selector, so result is the actual object
      expect(result).toEqual({
        transform: 'translate3d(10px, 20px, 30px)',
        backgroundColor: 'green',
        borderColor: 'yellow',
        width: 300,
        height: 400,
      });
    });

    it('should maintain type safety', () => {
      const model = createModel<{
        str: string;
        num: number;
        bool: boolean;
      }>(() => ({
        str: 'hello',
        num: 42,
        bool: true,
      }));

      const stringSlice = createSlice(
        model,
        (m: { str: string; num: number; bool: boolean }) => ({ value: m.str })
      );
      const numberSlice = createSlice(
        model,
        (m: { str: string; num: number; bool: boolean }) => ({ value: m.num })
      );
      const booleanSlice = createSlice(
        model,
        (m: { str: string; num: number; bool: boolean }) => ({ value: m.bool })
      );

      const composed = createSlice(
        model,
        compose(
          { str: stringSlice, num: numberSlice, bool: booleanSlice },
          (m, deps) => {
            // TypeScript should know the types
            const strVal: string = deps.str.value;
            const numVal: number = deps.num.value;
            const boolVal: boolean = deps.bool.value;

            return {
              concatenated: m.num,
              isEnabled: boolVal,
              allValues: [strVal, numVal, boolVal] as const,
            };
          }
        )
      );

      const result = composed({ str: 'test', num: 100, bool: false });

      // Verify the result matches expected shape
      expect(result).toEqual({
        concatenated: 100,
        isEnabled: false,
        allValues: ['test', 100, false],
      });
    });

    it('should work with nested slice compositions', () => {
      const model = createModel<{
        a: number;
        b: number;
        c: number;
        op: 'add' | 'multiply';
      }>(() => ({
        a: 1,
        b: 2,
        c: 3,
        op: 'add',
      }));

      // Base slices
      const aSlice = createSlice(
        model,
        (m: { a: number; b: number; c: number; op: 'add' | 'multiply' }) => ({
          value: m.a,
        })
      );
      const bSlice = createSlice(
        model,
        (m: { a: number; b: number; c: number; op: 'add' | 'multiply' }) => ({
          value: m.b,
        })
      );
      const cSlice = createSlice(
        model,
        (m: { a: number; b: number; c: number; op: 'add' | 'multiply' }) => ({
          value: m.c,
        })
      );
      const opSlice = createSlice(
        model,
        (m: { a: number; b: number; c: number; op: 'add' | 'multiply' }) => ({
          operation: m.op,
        })
      );

      // Intermediate composition
      const abSlice = createSlice(
        model,
        compose({ a: aSlice, b: bSlice, op: opSlice }, (_, { a, b, op }) => ({
          result:
            op.operation === 'add' ? a.value + b.value : a.value * b.value,
        }))
      );

      // Final composition using intermediate
      const finalSlice = createSlice(
        model,
        compose({ ab: abSlice, c: cSlice }, (_, { ab, c }) => ({
          finalResult: ab.result + c.value,
        }))
      );

      const addResult = finalSlice({ a: 5, b: 3, c: 2, op: 'add' });

      // Verify nested composition works correctly
      expect(addResult).toEqual({ finalResult: 10 }); // (5 + 3) + 2

      const multiplyResult = finalSlice({ a: 5, b: 3, c: 2, op: 'multiply' });
      expect(multiplyResult).toEqual({ finalResult: 17 }); // (5 * 3) + 2
    });
  });
}

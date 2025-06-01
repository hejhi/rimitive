/**
 * @fileoverview Compose utility for createSlice dependency injection
 *
 * Provides a clean way to compose slices with explicit dependencies,
 * eliminating the need for select() markers and recursive resolution.
 */

import type { SliceFactory } from './index';

/**
 * Result of compose() - a selector function that has access to dependencies
 */
export interface ComposedSelector<Model, Deps, Result> {
  (model: Model): Result;
  __composeDeps?: Deps; // Internal marker for tracking dependencies
}

/**
 * Compose function for dependency injection in createSlice
 *
 * @param deps - Object mapping dependency names to slice factories
 * @param selector - Function that receives model and resolved dependencies
 * @returns A selector function that can be passed to createSlice
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
  selector: (
    model: Model,
    resolvedDeps: {
      [K in keyof Deps]: Deps[K] extends SliceFactory<Model, infer T>
        ? T
        : never;
    }
  ) => Result
): ComposedSelector<Model, Deps, Result> {
  // Type for resolved dependencies
  type ResolvedDeps = {
    [K in keyof Deps]: Deps[K] extends SliceFactory<Model, infer T>
      ? T
      : never;
  };

  // Create the composed selector
  const composedSelector = (model: Model): Result => {
    // Build resolved dependencies object
    // We need to use type assertions here because TypeScript cannot
    // track the relationship between keys and values through dynamic property access
    const entries = Object.entries(deps) as Array<[keyof Deps, Deps[keyof Deps]]>;
    const resolvedDeps = entries.reduce((acc, [key, sliceFactory]) => {
      return {
        ...acc,
        [key]: sliceFactory(model)
      };
    }, {} as ResolvedDeps);

    // Call the selector with model and resolved dependencies
    return selector(model, resolvedDeps);
  };

  // Attach deps for potential adapter optimizations
  composedSelector.__composeDeps = deps;

  return composedSelector;
}


// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice } = await import('./index');

  describe('compose', () => {
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

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
      }));

      const userSlice = createSlice(model, (m) => ({
        name: m.user.name,
        email: m.user.email,
      }));

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

      expect(result.onClick).toBe(modelData.increment);
      expect(result.userName).toBe('Bob');
      expect(result.count).toBe(5);
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

      const positionSlice = createSlice(model, (m) => ({
        x: m.x,
        y: m.y,
        z: m.z,
      }));

      const colorSlice = createSlice(model, (m) => m.colors);
      const sizeSlice = createSlice(model, (m) => m.sizes);

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

      expect(result.transform).toBe('translate3d(10px, 20px, 30px)');
      expect(result.backgroundColor).toBe('green');
      expect(result.borderColor).toBe('yellow');
      expect(result.width).toBe(300);
      expect(result.height).toBe(400);
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

      const stringSlice = createSlice(model, (m) => ({ value: m.str }));
      const numberSlice = createSlice(model, (m) => ({ value: m.num }));
      const booleanSlice = createSlice(model, (m) => ({ value: m.bool }));

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

      expect(result.concatenated).toBe(100);
      expect(result.isEnabled).toBe(false);
      expect(result.allValues).toEqual(['test', 100, false]);
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
      const aSlice = createSlice(model, (m) => ({ value: m.a }));
      const bSlice = createSlice(model, (m) => ({ value: m.b }));
      const cSlice = createSlice(model, (m) => ({ value: m.c }));
      const opSlice = createSlice(model, (m) => ({ operation: m.op }));

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
      expect(addResult.finalResult).toBe(10); // (5 + 3) + 2

      const multiplyResult = finalSlice({ a: 5, b: 3, c: 2, op: 'multiply' });
      expect(multiplyResult.finalResult).toBe(17); // (5 * 3) + 2
    });
  });
}

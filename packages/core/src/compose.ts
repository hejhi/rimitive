/**
 * @fileoverview Compose utility for createSlice dependency injection
 *
 * Provides a clean way to compose slices with explicit dependencies.
 *
 * This implementation uses a purely functional approach with multiple
 * function layers to encode composition data.
 */

import type { SliceFactory } from './index';

/**
 * Type for resolved dependencies
 * Extract the slice result type from each SliceFactory in Deps
 */
type ResolveDeps<Deps> = {
  [K in keyof Deps]: Deps[K] extends SliceFactory<infer _Model, infer Slice>
    ? Slice
    : never;
};

/**
 * Compose function for dependency injection in createSlice
 *
 * @param deps - Object mapping dependency names to slice factories
 * @param selector - Function that receives model and resolved dependencies
 * @returns A selector function that resolves dependencies internally and accepts required api parameter
 *
 * @example
 * ```typescript
 * const actions = createSlice(model, (m) => ({
 *   increment: m().increment,
 *   decrement: m().decrement
 * }));
 *
 * const userSlice = createSlice(model, (m) => ({
 *   name: m().user.name,
 *   email: m().user.email
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
): (getModel: () => Model) => Result {
  // Return a selector function that resolves dependencies and accepts required api parameter
  return (getModel: () => Model): Result => {
    // Build resolved dependencies using Object.fromEntries for type safety
    // Pass both model and api to each dependency slice
    const entries = Object.entries(deps).map(([key, sliceFactory]) => [
      key,
      sliceFactory(getModel),
    ]);
    const resolvedDeps = Object.fromEntries(entries) as ResolveDeps<Deps>;

    // Call the selector with model and resolved dependencies
    return selector(getModel(), resolvedDeps);
  };
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice } = await import('./index');

  describe('compose', () => {
    it('should create a selector that resolves dependencies', () => {
      const model = createModel<{ count: number }>(() => ({ count: 0 }));
      const slice = createSlice(model, (m) => ({
        value: () => m().count,  // Getter function
      }));

      // Use compose within createSlice as intended
      const composedSlice = createSlice(
        model,
        compose({ mySlice: slice }, (_, deps) => ({
          doubled: () => deps.mySlice.value() * 2,  // Call getter, wrap in new getter
        }))
      );

      // Test the composed slice with initial data
      const modelData = { count: 5 };
      const result = composedSlice(() => modelData);
      expect(result.doubled()).toBe(10);
      
      // Test that it reflects updated data
      const modelData2 = { count: 7 };
      const result2 = composedSlice(() => modelData2);
      expect(result2.doubled()).toBe(14);
    });

    it('should work with multiple dependencies', () => {
      const model = createModel<{ x: number; y: number }>(() => ({
        x: 0,
        y: 0,
      }));
      const xSlice = createSlice(model, (m) => ({
        value: () => m().x,  // Getter function
      }));
      const ySlice = createSlice(model, (m) => ({
        value: () => m().y,  // Getter function
      }));

      // Use compose within createSlice
      const composedSlice = createSlice(
        model,
        compose({ x: xSlice, y: ySlice }, (_, deps) => ({
          sum: () => deps.x.value() + deps.y.value(),  // Call getters, wrap result
        }))
      );

      // Test the composed slice
      const result = composedSlice(() => ({ x: 3, y: 4 }));
      expect(result.sum()).toBe(7);
      
      // Test with different values
      const result2 = composedSlice(() => ({ x: 10, y: 20 }));
      expect(result2.sum()).toBe(30);
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
        (m) => ({
          increment: m().increment,  // Action stays as-is
        })
      );

      const userSlice = createSlice(
        model,
        (m) => ({
          name: () => m().user.name,    // Getter function
          email: () => m().user.email,  // Getter function
        })
      );

      const composed = createSlice(
        model,
        compose({ actions, userSlice }, (m, { actions, userSlice }) => ({
          onClick: actions.increment,                // Action stays as-is
          userName: () => userSlice.name(),         // Call getter, wrap in new getter
          count: () => m.count,                     // Wrap in getter
        }))
      );

      const modelData = {
        count: 5,
        increment: () => {},
        user: { name: 'Bob', email: 'bob@example.com' },
      };

      const result = composed(() => modelData);

      // Test initial values
      expect(result.onClick).toBe(modelData.increment);
      expect(result.userName()).toBe('Bob');
      expect(result.count()).toBe(5);
      
      // Test with different data
      const modelData2 = {
        count: 10,
        increment: () => {},
        user: { name: 'Charlie', email: 'charlie@example.com' },
      };
      
      const result2 = composed(() => modelData2);
      expect(result2.userName()).toBe('Charlie');
      expect(result2.count()).toBe(10);
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
        (m) => ({
          x: () => m().x,
          y: () => m().y,
          z: () => m().z,
        })
      );

      const colorSlice = createSlice(
        model,
        (m) => ({
          primary: () => m().colors.primary,
          secondary: () => m().colors.secondary,
        })
      );
      const sizeSlice = createSlice(
        model,
        (m) => ({
          width: () => m().sizes.width,
          height: () => m().sizes.height,
        })
      );

      const viewSlice = createSlice(
        model,
        compose(
          { position: positionSlice, colors: colorSlice, sizes: sizeSlice },
          (_, { position, colors, sizes }) => ({
            transform: () => `translate3d(${position.x()}px, ${position.y()}px, ${position.z()}px)`,
            backgroundColor: () => colors.primary(),
            borderColor: () => colors.secondary(),
            width: () => sizes.width(),
            height: () => sizes.height(),
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

      const result = viewSlice(() => modelData);

      // Test getter functions
      expect(result.transform()).toBe('translate3d(10px, 20px, 30px)');
      expect(result.backgroundColor()).toBe('green');
      expect(result.borderColor()).toBe('yellow');
      expect(result.width()).toBe(300);
      expect(result.height()).toBe(400);
      
      // Test with different data
      const modelData2 = {
        x: 50,
        y: 60,
        z: 70,
        colors: { primary: 'purple', secondary: 'orange' },
        sizes: { width: 500, height: 600 },
      };
      
      const result2 = viewSlice(() => modelData2);
      expect(result2.transform()).toBe('translate3d(50px, 60px, 70px)');
      expect(result2.backgroundColor()).toBe('purple');
      expect(result2.borderColor()).toBe('orange');
      expect(result2.width()).toBe(500);
      expect(result2.height()).toBe(600);
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
        (m) => ({ value: m().str })
      );
      const numberSlice = createSlice(
        model,
        (m) => ({ value: m().num })
      );
      const booleanSlice = createSlice(
        model,
        (m) => ({ value: m().bool })
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

      const result = composed(() => ({ str: 'test', num: 100, bool: false }));

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
        (m) => ({
          value: m().a,
        })
      );
      const bSlice = createSlice(
        model,
        (m) => ({
          value: m().b,
        })
      );
      const cSlice = createSlice(
        model,
        (m) => ({
          value: m().c,
        })
      );
      const opSlice = createSlice(
        model,
        (m) => ({
          operation: m().op,
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

      const addResult = finalSlice(() => ({ a: 5, b: 3, c: 2, op: 'add' }));

      // Verify nested composition works correctly
      expect(addResult).toEqual({ finalResult: 10 }); // (5 + 3) + 2

      const multiplyResult = finalSlice(() => ({ a: 5, b: 3, c: 2, op: 'multiply' }));
      expect(multiplyResult).toEqual({ finalResult: 17 }); // (5 * 3) + 2
    });

    it('should pass through api parameter to dependency slices', () => {
      const model = createModel<{ value: number }>(() => ({ value: 10 }));

      // Create a slice that uses the api parameter
      const apiAwareSlice = createSlice(model, (m) => ({
        value: m().value,
        hasApi: true,
        stateFromModel: m().value,
      }));

      // Create a composed slice that depends on the api-aware slice
      const composedSlice = createSlice(
        model,
        compose({ dep: apiAwareSlice }, (m, { dep }) => ({
          depValue: dep.value,
          depHasApi: dep.hasApi,
          depStateFromModel: dep.stateFromModel,
          composerHasApi: true,
          directValue: m.value,
        }))
      );

      const resultWithApi1 = composedSlice(() => ({ value: 20 }));
      expect(resultWithApi1).toEqual({
        depValue: 20,
        depHasApi: true,
        depStateFromModel: 20,
        composerHasApi: true,
        directValue: 20,
      });

      const resultWithApi2 = composedSlice(() => ({ value: 20 }));
      expect(resultWithApi2).toEqual({
        depValue: 20,
        depHasApi: true,
        depStateFromModel: 20,
        composerHasApi: true,
        directValue: 20,
      });
    });

    it('should pass api through nested compose calls', () => {
      const model = createModel<{ x: number; y: number }>(() => ({
        x: 1,
        y: 2,
      }));

      // Base slice
      const baseSlice = createSlice(model, (m) => ({
        x: m().x,
        fromModel: m().x,
      }));

      // First level of composition
      const level1 = createSlice(
        model,
        compose({ base: baseSlice }, (m, { base }) => ({
          baseX: base.x,
          baseFromModel: base.fromModel,
          y: m.y,
          level1HasApi: true,
        }))
      );

      // Second level of composition
      const level2 = createSlice(
        model,
        compose({ l1: level1 }, (_, { l1 }) => ({
          l1Data: l1,
          sum: l1.baseX + l1.y,
          level2HasApi: true,
        }))
      );

      const result = level2(() => ({ x: 5, y: 10 }));
      expect(result.l1Data.baseX).toBe(5);
      expect(result.l1Data.baseFromModel).toBe(5); // From model
      expect(result.l1Data.y).toBe(10);
      expect(result.l1Data.level1HasApi).toBe(true);
      expect(result.sum).toBe(15); // 5 + 10
      expect(result.level2HasApi).toBe(true);
    });

    it('should work with all slices requiring api parameter', () => {
      const model = createModel<{
        count: number;
        user: { name: string; role: string };
        settings: { theme: string; notifications: boolean };
      }>(() => ({
        count: 0,
        user: { name: 'John', role: 'admin' },
        settings: { theme: 'light', notifications: true },
      }));

      // Create slices that require api parameter
      const countSlice = createSlice(model, (m) => ({
        value: m().count,
        doubled: m().count * 2,
      }));

      const userSlice = createSlice(model, (m) => ({
        name: m().user.name,
        role: m().user.role,
        isAdmin: m().user.role === 'admin',
      }));

      // Compose with required api parameter
      const composedSlice = createSlice(
        model,
        compose(
          { count: countSlice, user: userSlice },
          (m, { count, user }) => ({
            // All selectors now require api parameter
            total: count.value,
            doubledTotal: count.doubled,
            userName: user.name,
            userRole: user.role,
            canEdit: user.isAdmin && m.settings.notifications,
            theme: m.settings.theme,
          })
        )
      );

      // Test with api parameter
      const modelData = {
        count: 5,
        user: { name: 'Alice', role: 'user' },
        settings: { theme: 'dark', notifications: false },
      };

      const result = composedSlice(() => modelData);

      expect(result).toEqual({
        total: 5,
        doubledTotal: 10,
        userName: 'Alice',
        userRole: 'user',
        canEdit: false, // Not admin, so false
        theme: 'dark',
      });

      // Test with admin user
      const adminData = {
        count: 3,
        user: { name: 'Bob', role: 'admin' },
        settings: { theme: 'light', notifications: true },
      };

      const adminResult = composedSlice(() => adminData);

      expect(adminResult).toEqual({
        total: 3,
        doubledTotal: 6,
        userName: 'Bob',
        userRole: 'admin',
        canEdit: true, // Admin and notifications enabled
        theme: 'light',
      });

      // Verify that api parameter is always required
      // The result should be the same with the same model data
      const resultWithSameApi = composedSlice(() => modelData);
      expect(resultWithSameApi).toEqual(result);
    });
  });
}

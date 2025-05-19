import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  ModelCompositionTools,
  SelectorsCompositionTools,
  ActionsCompositionTools,
  ViewCompositionTools,
  StoreFactoryTools,
} from '../types';

import { composeWith, selectWith } from './core';

// Define the ViewParamsToToolsAdapter to represent view tools
interface ViewParamsToToolsAdapter<TSelectors = unknown, TActions = unknown> {
  getSelectors?: () => TSelectors;
  getActions?: () => TActions;
}

/**
 * Unified fluent API for composing all Lattice entities (model, selectors, actions, view) with best-in-class type inference.
 *
 * Usage:
 *   const enhanced = compose(base).with<Ext>(cb)
 *
 * - The base type is inferred from base.
 * - The extension type is specified once at the point of extension.
 * - The callback receives tools typed to the merged shape (for model/state) or correct tools (for actions/view).
 * - The result is a new instance with the correct type.
 *
 * This is the recommended public API for Lattice composition.
 */
export function compose<B>(base: ModelFactory<B>): {
  with<Ext>(
    cb: (tools: ModelCompositionTools<B, Ext>) => Ext
  ): (tools: StoreFactoryTools<B & Ext>) => B & Ext;
};

export function compose<B>(base: SelectorsFactory<B>): {
  with<Ext, TModel>(
    cb: (tools: SelectorsCompositionTools<TModel>) => Ext
  ): (options: { get: () => B & Ext }) => B & Ext;
  select<Selected extends Partial<B>>(
    selector: (base: B) => Selected
  ): SelectorsFactory<Selected>;
};

export function compose<B>(base: ActionsFactory<B>): {
  with<Ext, TModel>(
    cb: (tools: ActionsCompositionTools<TModel>) => Ext
  ): (options: { mutate: <M>(model: M) => any }) => B & Ext;
};

export function compose<B>(base: ViewFactory<B>): {
  with<Ext, TSelectors, TActions>(
    cb: (tools: ViewCompositionTools<TSelectors, TActions>) => Ext
  ): (options: ViewParamsToToolsAdapter<TSelectors, TActions>) => B & Ext;
  select<Selected extends Partial<B>>(
    selector: (base: B) => Selected
  ): ViewFactory<Selected>;
};

/**
 * Implementation of the compose function that dispatches to the appropriate overload.
 * Uses type discrimination at runtime to maintain type safety.
 *
 * This matches the API surface described in the spec at lines 89-97.
 */
// Implementation function that handles the overloaded scenarios using type discrimination
export function compose<B>(
  base:
    | ModelFactory<B>
    | SelectorsFactory<B>
    | ActionsFactory<B>
    | ViewFactory<B>
): any {
  // Type-safe implementation that dispatches to appropriate overloads based on runtime checks
  return {
    with: (cb: unknown) => {
      // composeWith handles the type discrimination internally
      return composeWith(base as any, cb as any);
    },
    select: (selector: unknown) => {
      // selectWith will handle type discrimination internally
      return selectWith(base as any, selector as any);
    },
  };
}

// No need for additional imports, already imported at the top

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('compose', async () => {
    // Import the necessary functions for testing
    const { isSelectorsFactory, isViewFactory, brandWithSymbol } = await import(
      '../identify'
    );
    const { SELECTORS_FACTORY_BRAND, VIEW_FACTORY_BRAND } = await import(
      '../types'
    );

    it('should support fluent compose', () => {
      expect(typeof compose).toBe('function');
    });

    it('should demonstrate select usage with selectors in real API usage', async () => {
      // Define selector structure
      interface BaseSelectors {
        count: number;
        name: string;
        isActive: boolean;
      }

      // Create a selectors factory that matches the correct type
      const mockSelectorsFn = () => ({
        count: 42,
        name: 'test',
        isActive: true,
      });

      // We need to properly type the factory function - this matches how the real factory works
      const mockSelectorsFactory = () => (_: { get: () => any }) =>
        mockSelectorsFn();

      // Brand it as a SelectorsFactory
      const baseSelectorsFactory = brandWithSymbol(
        mockSelectorsFactory,
        SELECTORS_FACTORY_BRAND
      ) as unknown as SelectorsFactory<BaseSelectors>;

      // Ensure it's properly branded
      expect(isSelectorsFactory(baseSelectorsFactory)).toBe(true);

      // Define the selected subset
      interface SelectedSelectors {
        count: number;
        isActive: boolean;
      }

      // Use the select method to cherry-pick properties
      const selectedFactory = compose(
        baseSelectorsFactory
      ).select<SelectedSelectors>((base: BaseSelectors) => ({
        count: base.count,
        isActive: base.isActive,
        // name is intentionally omitted
      }));

      // Verify the result is still a selectors factory
      expect(isSelectorsFactory(selectedFactory)).toBe(true);

      // Create mock tools to instantiate the factory
      const mockGet = vi.fn();
      const selectedSelectors = selectedFactory()({ get: mockGet });

      // Verify the selected properties are present
      expect(selectedSelectors).toHaveProperty('count');
      expect(selectedSelectors).toHaveProperty('isActive');

      // Verify omitted properties are not present
      expect(selectedSelectors).not.toHaveProperty('name');

      // Verify values are correct
      expect(selectedSelectors.count).toBe(42);
      expect(selectedSelectors.isActive).toBe(true);
    });

    it('should demonstrate select usage with views in real API usage', async () => {
      // Define view structure
      interface BaseView {
        'aria-label': string;
        'data-count': number;
        onClick: () => void;
      }

      // Create a mock view function
      const mockViewFn = () => ({
        'aria-label': 'Test Label',
        'data-count': 42,
        onClick: vi.fn(),
      });

      // Create a factory function with the correct signature
      const mockViewFactory =
        () => (_: { getSelectors?: () => any; getActions?: () => any }) =>
          mockViewFn();

      // Brand it as a ViewFactory
      const baseViewFactory = brandWithSymbol(
        mockViewFactory,
        VIEW_FACTORY_BRAND
      ) as unknown as ViewFactory<BaseView>;

      // Ensure it's properly branded
      expect(isViewFactory(baseViewFactory)).toBe(true);

      // Define selected view properties
      interface SelectedView {
        'aria-label': string;
        'data-count': number;
      }

      // Use the select method to cherry-pick properties
      const selectedFactory = compose(baseViewFactory).select<SelectedView>(
        (base: BaseView) => ({
          'aria-label': base['aria-label'],
          'data-count': base['data-count'],
          // onClick is intentionally omitted
        })
      );

      // Verify the result is still a view factory
      expect(isViewFactory(selectedFactory)).toBe(true);

      // Create mock options to instantiate the factory
      const mockOptions = { getSelectors: () => ({}), getActions: () => ({}) };
      const selectedView = selectedFactory()(mockOptions as any);

      // Verify the selected properties are present
      expect(selectedView).toHaveProperty('aria-label');
      expect(selectedView).toHaveProperty('data-count');

      // Verify omitted properties are not present
      expect(selectedView).not.toHaveProperty('onClick');

      // Verify values are correct
      expect(selectedView['aria-label']).toBe('Test Label');
      expect(selectedView['data-count']).toBe(42);
    });

    it('should provide proper type safety for selectors', () => {
      // This test validates the TypeScript type system working correctly
      // It relies on type assertions to verify the types without runtime checks

      interface TypeSafeSelectors {
        count: number;
        name: string;
        flag: boolean;
      }

      // Create a mock factory function with the right signature
      const mockSelectorsFactoryFn = () => (_: { get: () => any }) => ({
        count: 1,
        name: 'test',
        flag: true,
      });

      // Brand it with explicit type casting
      const typedSelectorsFactory = brandWithSymbol(
        mockSelectorsFactoryFn,
        SELECTORS_FACTORY_BRAND
      ) as unknown as SelectorsFactory<TypeSafeSelectors>;

      // Define what we want to select
      interface SelectedTypeProps {
        count: number;
        flag: boolean;
      }

      // Use the select method with proper typing
      const typeSafeSubset = compose(
        typedSelectorsFactory
      ).select<SelectedTypeProps>((base: TypeSafeSelectors) => ({
        count: base.count,
        flag: base.flag,
        // name is intentionally omitted
      }));

      // Verify the result is a SelectorsFactory
      expect(isSelectorsFactory(typeSafeSubset)).toBe(true);

      // This is what should trigger a type error if uncommented:
      compose(typedSelectorsFactory).select<SelectedTypeProps>(
        (base: TypeSafeSelectors) => ({
          count: base.count,
          flag: base.flag,
          // @ts-expect-error
          nonExistent: base.nonExistent, // This would cause a TypeScript error
        })
      );
    });

    it('should provide proper type safety for views', () => {
      // This test validates the TypeScript type system working correctly
      // It relies on type assertions to verify the types

      interface TypeSafeView {
        'data-id': string;
        'aria-label': string;
        onClick: () => void;
      }

      // Create a mock factory function with the right signature
      const mockViewFactoryFn =
        () => (_: { getSelectors?: () => any; getActions?: () => any }) => ({
          'data-id': '123',
          'aria-label': 'Test',
          onClick: () => {},
        });

      // Brand it with explicit type casting
      const typedViewFactory = brandWithSymbol(
        mockViewFactoryFn,
        VIEW_FACTORY_BRAND
      ) as unknown as ViewFactory<TypeSafeView>;

      // Define what we want to select
      interface SelectedViewProps {
        'data-id': string;
        'aria-label': string;
      }

      // Use the select method with proper typing
      const typeSafeViewSubset = compose(
        typedViewFactory
      ).select<SelectedViewProps>((base: TypeSafeView) => ({
        'data-id': base['data-id'],
        'aria-label': base['aria-label'],
        // onClick is intentionally omitted
      }));

      // Verify the result is a ViewFactory
      expect(isViewFactory(typeSafeViewSubset)).toBe(true);

      // This is what should trigger a type error if uncommented:
      compose(typedViewFactory).select<SelectedViewProps>(
        // @ts-expect-error
        (base: TypeSafeView) => ({
          'data-id': base['data-id'],
          // @ts-expect-error
          nonexistent: base.nonExistentProperty, // This would cause a TypeScript error
        })
      );
    });
  });
}

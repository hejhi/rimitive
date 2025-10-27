/**
 * User-space map() helper using stable signal pattern
 *
 * Key design principles:
 * - Render callback runs ONCE per key (no orphaned computeds)
 * - Each item gets a stable signal that map() updates
 * - Keys extracted from el() calls (no separate keyFn parameter)
 * - Efficient reconciliation with LIS algorithm
 */

import type { RefSpec, ElementRef, NodeRef, FragmentRef, Reactive } from '../types';
import { isElementRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { reconcileWithKeys, type ReconcileState } from './reconcile';
import { createFragment } from './fragment';
import type { GlobalContext } from '@lattice/signals/context';
import { createUntracked } from '@lattice/signals/untrack';

export interface MapHelperOpts<
  TElement extends RendererElement,
  TText extends TextNode
> {
  ctx: LatticeContext;
  signalCtx: GlobalContext;
  signal: <T>(value: T) => Reactive<T> & ((value: T) => void);
  scopedEffect: (fn: () => void | (() => void)) => () => void;
  withElementScope: <T>(element: object, fn: () => T) => T;
  renderer: Renderer<TElement, TText>;
  disposeScope: CreateScopes['disposeScope'];
}

/**
 * Create a map helper with injected dependencies
 *
 * This is a factory that returns the map() function with access to
 * renderer, ctx, and other utilities
 */
export function createMapHelper<
  TElement extends RendererElement,
  TText extends TextNode
>(opts: MapHelperOpts<TElement, TText>) {
  const { ctx, signalCtx, signal, scopedEffect, withElementScope, renderer, disposeScope } = opts;

  // Create untracked helper to prevent render() from tracking outer reactive state
  const untrack = createUntracked({ ctx: signalCtx });

  /**
   * User-space map() with stable signals
   *
   * Each item gets a stable signal that map() manages. Render callback
   * runs ONCE per unique item, preventing orphaned computeds.
   *
   * Supports two keying strategies:
   * 1. Reference-based (default): Uses object identity as key (like Solid.js)
   * 2. Property-based (with keyFn): Uses a property value as key (like React)
   *
   * Usage:
   *   // Reference-based (mutable patterns)
   *   map(() => items(), (itemSignal) => Component(api, itemSignal))
   *
   *   // Property-based (immutable patterns)
   *   map(() => items(), (itemSignal) => Component(api, itemSignal), item => item.id)
   */
  function map<T>(
    items: () => T[],
    render: (itemSignal: Reactive<T>) => RefSpec<TElement>,
    keyFn?: (item: T) => string | number
  ): FragmentRef<TElement> {
    return createFragment((parent: ElementRef<TElement>, nextSibling?: NodeRef<TElement> | null) => {
      // Store signals and RefSpecs per key (separate from reconciliation)
      type ItemEntry = {
        signal: Reactive<T> & ((value: T) => void);
        refSpec: RefSpec<TElement>;
      };
      const itemData = new Map<unknown, ItemEntry>();

      // Reconciliation state (expected by reconcileWithKeys)
      const state: ReconcileState<TElement> = {
        itemsByKey: new Map(),
        parentElement: parent.element,
        parentRef: parent,
        nextSibling: nextSibling || undefined,
      };

      // Pooled buffers for LIS calculation
      const oldIndicesBuf: number[] = [];
      const newPosBuf: number[] = [];
      const lisBuf: number[] = [];

      // Create effect within parent's scope - auto-tracked!
      const effectDispose = withElementScope(parent.element, () => {
        return scopedEffect(() => {
          const currentItems = items();
          const refSpecs: RefSpec<TElement>[] = [];

          // Build RefSpecs array
          // For NEW items: create signal and call render
          // For EXISTING items: update signal, reuse stored RefSpec
          for (const item of currentItems) {
            // Determine key: object identity or property value
            const key = keyFn ? keyFn(item) : item;
            const existing = itemData.get(key);

            if (existing) {
              // Existing item: update signal with new data, reuse RefSpec
              existing.signal(item);
              refSpecs.push(existing.refSpec);
            } else {
              // New item: create signal, call render ONCE, store for future reuse
              const itemSignal = signal(item);

              // Call render untracked to prevent it from tracking outer reactive state
              // Components are "cold" - reactivity comes from expressions inside them
              const refSpec = untrack(() => render(itemSignal));

              // Store the key on the RefSpec for reconciliation
              refSpec.key = keyFn ? keyFn(item) : (item as unknown as string | number);

              itemData.set(key, {
                signal: itemSignal,
                refSpec,
              });
              refSpecs.push(refSpec);
            }
          }

          // Clear pooled buffers
          oldIndicesBuf.length = 0;
          newPosBuf.length = 0;
          lisBuf.length = 0;

          // Reconcile using keys from RefSpecs
          reconcileWithKeys(
            refSpecs,
            state,
            ctx,
            renderer,
            disposeScope,
            oldIndicesBuf,
            newPosBuf,
            lisBuf
          );
        });
      });

      // Return cleanup function
      return () => {
        // Dispose the effect
        effectDispose();

        // Clean up all tracked elements
        for (const [, node] of state.itemsByKey) {
          if (isElementRef(node)) {
            const scope = ctx.elementScopes.get(node.element);
            if (scope) {
              disposeScope(scope);
              ctx.elementScopes.delete(node.element);
            }
            renderer.removeChild(state.parentElement, node.element);
          }
        }
        state.itemsByKey.clear();
        itemData.clear();
      };
    });
  }

  return map;
}

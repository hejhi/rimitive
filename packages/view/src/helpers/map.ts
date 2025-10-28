/**
 * User-space map() helper using stable signal pattern
 *
 * Key design principles:
 * - Render callback runs ONCE per key (no orphaned computeds)
 * - Each item gets a stable signal that map() updates
 * - Keys extracted from el() calls (no separate keyFn parameter)
 * - Efficient reconciliation with LIS algorithm
 */

import type { RefSpec, ElementRef, NodeRef, FragmentRef, Reactive, RenderScope } from '../types';
import { isElementRef, resolveNextRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';
import type { CreateScopes } from './scope';
import { createReconciler } from './reconcile';
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
  renderer: Renderer<TElement, TText>;
  createScope: CreateScopes['createScope'];
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
  const { ctx, signalCtx, signal, scopedEffect, renderer, createScope, disposeScope } = opts;

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
      // Store signals, RefSpecs, and scopes per key (separate from reconciliation)
      type ItemEntry = {
        signal: Reactive<T> & ((value: T) => void);
        refSpec: RefSpec<TElement>;
        scope: RenderScope;
      };
      const itemData = new Map<unknown, ItemEntry>();

      // Create reconciler with internal state management and hooks
      const { reconcile, dispose } = createReconciler<T, TElement>({
        parentElement: parent.element,
        parentRef: parent,
        nextSibling: nextSibling || undefined,

        // onCreate: called when new item needs to be created
        onCreate: untrack(() => (item, key) => {
          // New item: create signal, call render ONCE, store for future reuse
          const itemSignal = signal(item);

          // Create a dedicated scope for this row's disposables
          // This ensures each row's computeds/effects are tracked independently
          const rowScope = createScope(parent.element);

          // Call render with row's scope active so any computeds/effects created
          // during component initialization are tracked for disposal
          let refSpec: RefSpec<TElement>;
          let nodeRef: NodeRef<TElement>;

          const prevScope = ctx.activeScope;
          ctx.activeScope = rowScope;
          try {
            // Render is still "cold" (untracked) but now has activeScope set
            // This ensures computeds/effects created during render are tracked for disposal
            // while preventing the render function itself from tracking dependencies
            refSpec = render(itemSignal);
            nodeRef = refSpec.create();
          } finally {
            ctx.activeScope = prevScope;
          }

          // Store signal, RefSpec, and scope for future updates/cleanup
          itemData.set(key, {
            signal: itemSignal,
            refSpec,
            scope: rowScope,
          });

          // Insert into DOM
          if (isElementRef(nodeRef!)) {
            const nextEl =
              resolveNextRef(nextSibling || undefined)?.element ?? null;
            renderer.insertBefore(
              parent.element,
              nodeRef.element,
              nextEl
            );
          }

          return nodeRef!;
        }),

        // onUpdate: called when existing item's data should be updated
        onUpdate: (key, item) => {
          const existing = itemData.get(key);
          if (existing) existing.signal(item);
        },

        // onMove: called when item needs repositioning
        onMove: (_key, node, nextSiblingNode) => {
          if (!isElementRef(node)) return;

          let nextEl: TElement | null = null;

          if (nextSiblingNode && isElementRef(nextSiblingNode)) {
            nextEl = nextSiblingNode.element;
          } else if (!nextSiblingNode) {
            nextEl = resolveNextRef(nextSibling || undefined)?.element ?? null;
          }

          renderer.insertBefore(parent.element, node.element, nextEl);
        },

        // onRemove: called when item is being removed
        onRemove: (key, node) => {
          // Dispose the row's scope (automatically disposes child element scope via hierarchy)
          const entry = itemData.get(key);
          if (entry) disposeScope(entry.scope);

          // Clean up itemData
          itemData.delete(key);

          // Remove from DOM and clean up element scope registration
          if (!isElementRef(node)) return;
          ctx.elementScopes.delete(node.element);
          renderer.removeChild(parent.element, node.element);
        },
      });

      // Create effect within parent's scope - auto-tracked!
      const effectDispose = scopedEffect(() => {
        const currentItems = items();

        // Reconcile with just items and key function
        reconcile(
          currentItems,
          (item) => keyFn ? keyFn(item) : item as unknown as string | number
        );
      });

      // Return cleanup function
      return () => {
        // Dispose the effect
        effectDispose();

        // Dispose all remaining items via reconciler
        // This calls onRemove hook for each tracked item
        dispose();

        // Clear remaining data
        itemData.clear();
      };
    });
  }

  return map;
}

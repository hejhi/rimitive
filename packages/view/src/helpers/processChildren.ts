/**
 * Process children into linked list and attach fragments
 *
 * Two-pass algorithm:
 * 1. Forward pass: Build intrusive linked list, append element children
 * 2. Backward pass: Attach fragment children with correct insertion points
 */

import type { NodeRef, ElementRef, ElRefSpecChild, Disposable, FragmentRef, RenderScope } from '../types';
import { isElementRef, isFragmentRef, isReactive, isRefSpec, STATUS_FRAGMENT, resolveNextRef } from '../types';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { CreateScopes } from './scope';
import type { LatticeContext } from '../context';

/**
 * Fragment that manages dynamic function children
 * Holds scope and tracks children for cleanup/replacement on re-render
 */
interface DynamicChildrenFragRef<TElement> extends FragmentRef<TElement> {
  element: TElement | null;
  childrenRefs: NodeRef<TElement>[];
  scope: RenderScope<TElement>;
}

export function createProcessChildren<TElement extends RendererElement, TText extends TextNode>(opts: {
  effect: (fn: () => void | (() => void)) => () => void;
  renderer: Renderer<TElement, TText>;
  trackInScope: (disposable: Disposable) => void;
  createScope: CreateScopes['createScope'];
  ctx: LatticeContext;
  disposeScope: CreateScopes['disposeScope'];
}) {
  const { effect, renderer, trackInScope, createScope, ctx, disposeScope } = opts;

  const handleChild = (
    parentRef: ElementRef<TElement>,
    child: ElRefSpecChild<TElement>
  ): NodeRef<TElement> | null => {
    const element = parentRef.element;
    const childType = typeof child;

    // Skip null/undefined/false
    if (child == null || child === false || childType === 'boolean')
      return null;

    // Static primitive (string, number)
    if (childType === 'string' || childType === 'number') {
      const textNode = renderer.createTextNode(String(child));
      renderer.appendChild(element, textNode);
      return null; // Text nodes don't participate in ref node chain
    }

    if (childType === 'function') {
      // Element ref (from el()) - instantiate blueprint
      if (isRefSpec<TElement>(child)) {
        const childRef = child.create();

        // Append element if this is an ElementRef (fragments get attached later)
        if (isElementRef(childRef)) renderer.appendChild(element, childRef.element);

        return childRef;
      }

      // The only other functions allowed are reactives
      if (isReactive(child)) {
        const textNode = renderer.createTextNode('');
        const dispose = effect(() => {
          const value = child();
          // Convert to string, handling null/undefined and primitives only
          const stringValue =
            value == null ? '' : String(value as string | number | boolean);
          renderer.updateTextNode(textNode, stringValue);
        });

        // Track effect for cleanup when element is removed
        trackInScope({ dispose });
        renderer.appendChild(element, textNode);
        return null; // Text nodes don't participate in ref node chain
      }

      // Bare function child - returns RefSpec or RefSpec[]
      // Example: () => items().map(item => el(['li', item]))
      // Type assertion safe here: checked typeof === 'function' and not RefSpec/Reactive
      type BareFunction = () => import('../types').RefSpec<TElement> | import('../types').RefSpec<TElement>[] | null | false;
      const bareFunction = child as BareFunction;

      // Pre-allocate fragment ref
      const dynamicFragRef: DynamicChildrenFragRef<TElement> & { parentRef?: ElementRef<TElement> } = {
        status: STATUS_FRAGMENT,
        element: null,
        prev: undefined,
        next: undefined,
        childrenRefs: [],
        scope: undefined as any, // Set below
        parentRef: undefined, // Set in attach
        attach: (parentRefArg: ElementRef<TElement>, nextSibling?: ElementRef<TElement> | null): void => {
          // 0 allocations - just wire up pointers
          dynamicFragRef.element = parentRefArg.element;
          dynamicFragRef.parentRef = parentRefArg;

          // Store boundary marker if provided
          if (nextSibling && !dynamicFragRef.next) {
            dynamicFragRef.next = nextSibling;
          }

          // Wire scope to parent retroactively
          dynamicFragRef.scope.element = parentRefArg.element;
          dynamicFragRef.scope.parent = ctx.activeScope as RenderScope<TElement>;

          // Attach scope to parent's child list
          if (dynamicFragRef.scope.parent) {
            dynamicFragRef.scope.nextSibling = dynamicFragRef.scope.parent.firstChild;
            dynamicFragRef.scope.parent.firstChild = dynamicFragRef.scope;
          }

          // Trigger effect to run now that parentElement is set (0 allocations - just calls existing renderFn)
          dynamicFragRef.scope.flush();
        },
      };

      // Pre-allocate scope with renderFn (runs when signals change)
      const fragScope = createScope(
        null as any,
        undefined as any,
        () => {
          const parentElement = dynamicFragRef.element;
          if (!parentElement) return; // Not attached yet
            // Cleanup previous children
            for (const nodeRef of dynamicFragRef.childrenRefs) {
              if (isElementRef(nodeRef)) {
                const oldElement = nodeRef.element;
                const oldScope = ctx.elementScopes.get(oldElement);
                if (oldScope) {
                  disposeScope(oldScope);
                  ctx.elementScopes.delete(oldElement);
                }
                renderer.removeChild(parentElement, oldElement);
              } else if (isFragmentRef(nodeRef)) {
                // Call fragment's dispose if available (for map() fragments)
                if ('dispose' in nodeRef && typeof nodeRef.dispose === 'function') {
                  nodeRef.dispose();
                }

                // Remove fragment's DOM children (for fragments with linked list)
                let child = nodeRef.firstChild;
                while (child) {
                  const next = child.next;
                  if (isElementRef(child)) {
                    const scope = ctx.elementScopes.get(child.element);
                    if (scope) {
                      disposeScope(scope);
                      ctx.elementScopes.delete(child.element);
                    }
                    renderer.removeChild(parentElement, child.element);
                  }
                  child = next;
                }

                // Dispose fragment's scope if it has one (for DynamicChildrenFragRef)
                const fragRef = nodeRef as DynamicChildrenFragRef<TElement>;
                if (fragRef.scope) {
                  disposeScope(fragRef.scope);
                }
              } else {
                // Text node (stored via cast)
                renderer.removeChild(parentElement, nodeRef as unknown as TText);
              }
            }
            dynamicFragRef.childrenRefs = [];

            // Call function to get new RefSpec(s)
            const result = bareFunction();
            const normalizedChildren: ElRefSpecChild<TElement>[] = Array.isArray(result)
              ? result
              : (result == null || result === false ? [] : [result]);

            const newChildrenRefs: NodeRef<TElement>[] = [];
            const fragmentsToAttach: FragmentRef<TElement>[] = [];

            // Create and insert new children
            for (const newChildSpec of normalizedChildren) {
              if (isRefSpec(newChildSpec)) {
                const nodeRef = newChildSpec.create();
                newChildrenRefs.push(nodeRef);

                if (isElementRef(nodeRef)) {
                  // Insert element into DOM
                  renderer.insertBefore(
                    parentElement,
                    nodeRef.element,
                    resolveNextRef(dynamicFragRef.next as NodeRef<TElement>)?.element ?? null
                  );
                } else if (isFragmentRef(nodeRef)) {
                  // Collect fragments for later attachment
                  fragmentsToAttach.push(nodeRef);
                }
              } else if (typeof newChildSpec === 'string' || typeof newChildSpec === 'number') {
                // Handle primitive text nodes
                const textNode = renderer.createTextNode(String(newChildSpec));
                renderer.insertBefore(
                  parentElement,
                  textNode,
                  resolveNextRef(dynamicFragRef.next as NodeRef<TElement>)?.element ?? null
                );
                // Track for cleanup (type cast to fit NodeRef array)
                newChildrenRefs.push(textNode as unknown as NodeRef<TElement>);
              }
            }

            // Attach collected fragments
            for (const fragmentRef of fragmentsToAttach) {
              fragmentRef.attach(dynamicFragRef.parentRef!, dynamicFragRef.next as ElementRef<TElement> | null | undefined);
            }

            dynamicFragRef.childrenRefs = newChildrenRefs;
          }
      );

      // Set scope on fragment ref
      dynamicFragRef.scope = fragScope;

      // Track scope for cleanup (pre-allocated, 0 allocations here)
      trackInScope({ dispose: () => disposeScope(fragScope) });

      return dynamicFragRef;
    }

    return null; // Default case
  }

  const processChildren = (
    parent: ElementRef<TElement>,
    children: ElRefSpecChild<TElement>[]
  ): void => {
    // Forward pass: build intrusive linked list
    let lastChildRef: NodeRef<TElement> | undefined;

    for (const child of children) {
      const refNode = handleChild(parent, child);

      if (!refNode) continue;
      if (lastChildRef) {
        lastChildRef.next = refNode;
        refNode.prev = lastChildRef;
      }
      lastChildRef = refNode;
    }

    // Backward pass: attach fragments with correct insertion points
    if (!lastChildRef) return;
    let nextRef: NodeRef<TElement> | null = null;

    do {
      if (isFragmentRef(lastChildRef)) lastChildRef.attach(parent, nextRef);
      else nextRef = lastChildRef;

      lastChildRef = lastChildRef.prev;
    } while (lastChildRef);
  };

  return {
    processChildren,
    handleChild
  }
}

/**
 * Mount - Composition and mounting entry point for Rimitive view applications
 *
 * Mount is the primary way to render components in the browser. It:
 * 1. Composes modules (like compose())
 * 2. Wraps the effect function to auto-scope effects
 * 3. Sets up a root scope so effects auto-dispose on unmount
 * 4. Returns an unmount function
 *
 * @example
 * ```typescript
 * import { mount } from '@rimitive/view/deps/mount';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 * import { createElModule } from '@rimitive/view/el';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 *
 * const unmount = mount(
 *   SignalModule,
 *   ComputedModule,
 *   EffectModule,
 *   createElModule(adapter)
 * )(document.getElementById('root')!, ({ signal, effect, el }) => () => {
 *   const count = signal(0);
 *
 *   // This effect auto-disposes when unmount() is called
 *   effect(() => console.log('Count:', count()));
 *
 *   return el('div')(
 *     el('button')
 *       .ref((btn) => btn.onclick = () => count(c => c + 1))
 *       ('Increment'),
 *     count
 *   );
 * });
 *
 * // Later: clean up all effects and remove from DOM
 * unmount();
 * ```
 */

import {
  compose,
  defineModule,
  type Module,
  type Use,
  type ComposedContext,
  type ContainsLazy,
} from '@rimitive/core';
import type { EffectFactory } from '@rimitive/signals';
import type { CreateScopes } from './scope';
import type { RefSpec, NodeRef } from '../types';

/**
 * A portable component - a function that receives a service and returns a factory
 * that produces a RefSpec when called.
 */
type PortableComponent<TSvc, TElement> = (svc: TSvc) => () => RefSpec<TElement>;

/**
 * Mount function type - returned by mount(...modules)
 */
type MountFn<TSvc> = <TElement>(
  container: Element,
  component: PortableComponent<TSvc, TElement>
) => () => void;

/**
 * Extract the service type from a tuple of modules.
 * Uses ContainsLazy to handle async module composition.
 */
type ServiceFromModules<TModules extends Module[]> =
  ContainsLazy<TModules> extends true
    ? never // mount() doesn't support async modules
    : Use<ComposedContext<TModules>>;

/**
 * Mount modules and render a component with automatic effect scoping.
 *
 * Takes modules (same as compose()), and wraps the effect function so that
 * effects created within the component tree are automatically disposed when
 * the returned unmount function is called.
 *
 * @param modules - Modules to compose
 * @returns A mount function that takes (container, component) and returns unmount()
 *
 * @example Basic usage
 * ```typescript
 * const unmount = mount(
 *   SignalModule, EffectModule, createElModule(adapter)
 * )(container, ({ signal, effect, el }) => () => {
 *   const count = signal(0);
 *   effect(() => console.log(count())); // Auto-disposed on unmount
 *   return el('div')(count);
 * });
 *
 * unmount(); // Disposes effect, removes from DOM
 * ```
 *
 * @example With resource (also auto-scoped)
 * ```typescript
 * const unmount = mount(
 *   SignalModule, EffectModule, ResourceModule, createElModule(adapter)
 * )(container, ({ resource, el }) => () => {
 *   const data = resource((signal) =>
 *     fetch('/api/data', { signal }).then(r => r.json())
 *   );
 *
 *   return el('div')(
 *     data.loading() ? 'Loading...' : data.latest()?.name
 *   );
 * });
 *
 * unmount(); // Aborts in-flight request, disposes resource
 * ```
 */
export function mount<TModules extends Module[]>(
  ...modules: TModules
): MountFn<ServiceFromModules<TModules>> {
  // Compose the modules normally
  const baseSvc = compose(...modules) as ServiceFromModules<TModules>;

  // Get the scopes instance from the composed service
  // This is guaranteed to exist if any view module (el, map, etc.) is included
  const scopes = (baseSvc as unknown as { scopes: CreateScopes }).scopes;

  // Get the base effect function
  const baseEffect = (baseSvc as unknown as { effect: EffectFactory }).effect;

  // Create a scoped effect wrapper
  const scopedEffect: EffectFactory = (run) => {
    const dispose = baseEffect(run);
    // Register in active scope if one exists
    scopes.registerDisposable(dispose);
    return dispose;
  };

  return <TElement>(
    container: Element,
    component: PortableComponent<ServiceFromModules<TModules>, TElement>
  ): (() => void) => {
    // Create root scope for this mount
    const rootScope = scopes.createRootScope();

    // Create a patched service with scoped effect
    const patchedSvc = Object.assign(
      // Make it callable like Use<T>
      <TResult>(fn: (svc: ServiceFromModules<TModules>) => TResult): TResult =>
        fn(patchedSvc as ServiceFromModules<TModules>),
      // Copy all properties from base service
      baseSvc as object,
      // Override effect with scoped version
      { effect: scopedEffect }
    ) as unknown as ServiceFromModules<TModules>;

    // Run component factory within the root scope
    // Any effects created will auto-register their dispose in rootScope
    const ref = scopes.withScope(rootScope, () => {
      const factory = component(patchedSvc);
      const spec = factory();
      return spec.create(patchedSvc);
    });

    // Get the actual DOM node to append
    const node = getNode(ref);
    if (node) {
      container.appendChild(node);
    }

    // Return unmount function
    return () => {
      // Dispose root scope - this disposes all tracked effects recursively
      scopes.disposeScope(rootScope);

      // Remove DOM node from container
      if (node && node.parentNode === container) {
        container.removeChild(node);
      }
    };
  };
}

/**
 * Extract the DOM node from a NodeRef
 */
function getNode<TElement>(ref: NodeRef<TElement>): Node | null {
  if (ref.element) {
    return ref.element as unknown as Node;
  }
  // For fragments, get the first child's node
  if (ref.firstChild) {
    return getNode(ref.firstChild);
  }
  return null;
}

/**
 * MountModule - Legacy module for backwards compatibility
 *
 * Provides a simple mount function that just calls spec.create().
 * For new code, prefer using the mount() function directly.
 *
 * @deprecated Use mount() function instead for automatic effect scoping
 */
export type MountFactory = <TElement>(spec: RefSpec<TElement>) => NodeRef<TElement>;

export const createMount = (): MountFactory => {
  return <TElement>(spec: RefSpec<TElement>): NodeRef<TElement> => {
    return spec.create();
  };
};

export const MountModule = defineModule({
  name: 'mount',
  create: createMount,
});

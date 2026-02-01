/**
 * Shadow primitive - renders children into a shadow root attached to the parent element
 *
 * Creates an isolated DOM subtree with encapsulated styles. The shadow root is
 * attached to the parent element when mounted.
 *
 * Usage:
 * ```typescript
 * // Simple case - declarative children
 * el('div').props({ className: 'host' })(
 *   shadow({ mode: 'open', styles: myStyles })(
 *     el('p')('Inside shadow DOM')
 *   )
 * )
 *
 * // With ref - access shadow root for imperative setup
 * el('div')(
 *   shadow({ mode: 'open', styles: css })
 *     .ref((shadowRoot) => {
 *       // Imperative setup with shadow root access
 *       const editor = createEditor({ root: shadowRoot });
 *       return () => editor.dispose(); // cleanup
 *     })
 *     (el('div')('Content'))
 * )
 * ```
 */

import type {
  RefSpec,
  FragmentRef,
  ElementRef,
  NodeRef,
  ElRefSpecChild,
  ParentContext,
} from './types';
import { STATUS_REF_SPEC, STATUS_FRAGMENT, STATUS_ELEMENT } from './types';
import type { Adapter, TreeConfig, NodeOf } from './adapter';
import type { CreateScopes } from './deps/scope';
import { ScopesModule } from './deps/scope';
import { createProcessChildren } from './deps/processChildren';
import { defineModule, type Module } from '@rimitive/core';

/**
 * Shadow DOM mode
 */
export type ShadowMode = 'open' | 'closed';

/**
 * Options for creating a shadow root
 */
export type ShadowOptions = {
  /** Shadow root mode - 'open' allows external access, 'closed' does not */
  mode?: ShadowMode;
  /** CSS styles to inject into the shadow root */
  styles?: string | string[];
  /** Whether to delegate focus */
  delegatesFocus?: boolean;
};

/**
 * Lifecycle callback for shadow - receives the shadow root
 */
export type ShadowLifecycleCallback = (
  shadowRoot: ShadowRoot
) => void | (() => void);

/**
 * Shadow factory - returned from shadow(options)
 * Callable with children to create RefSpec, or use .ref() to access shadow root
 */
export type ShadowFactory<TBaseElement> = {
  /**
   * Apply children to create a RefSpec
   * Children are mounted into the shadow root
   */
  (...children: ElRefSpecChild[]): RefSpec<TBaseElement>;

  /**
   * Update shadow options, returning a new ShadowFactory
   */
  props(
    optsOrFn: ShadowOptions | ((current: ShadowOptions) => ShadowOptions)
  ): ShadowFactory<TBaseElement>;

  /**
   * Add lifecycle callback(s), returning a new ShadowFactory
   * Callbacks receive the shadow root and can return cleanup functions
   */
  ref(...callbacks: ShadowLifecycleCallback[]): ShadowFactory<TBaseElement>;
};

/**
 * Shadow service type - creates shadow factories
 */
export type ShadowService<TBaseElement> = (
  options?: ShadowOptions
) => ShadowFactory<TBaseElement>;

/**
 * Options passed to shadow factory creator
 */
export type ShadowOpts<TConfig extends TreeConfig> = {
  scopedEffect: CreateScopes['scopedEffect'];
  onCleanup: CreateScopes['onCleanup'];
  adapter: Adapter<TConfig>;
};

/**
 * Create a shadow factory with the given dependencies.
 *
 * @example
 * ```ts
 * const shadow = createShadowFactory({ adapter, scopedEffect, onCleanup });
 *
 * el('div')(
 *   shadow({ mode: 'open', styles: css })(
 *     el('p')('Isolated content')
 *   )
 * )
 * ```
 */
export function createShadowFactory<TConfig extends TreeConfig>({
  scopedEffect,
  onCleanup,
  adapter,
}: ShadowOpts<TConfig>): ShadowService<NodeOf<TConfig>> {
  type TBaseElement = NodeOf<TConfig>;

  const { processChildren } = createProcessChildren<TConfig>({
    scopedEffect,
    adapter,
  });

  /**
   * Inject styles into a container (shadow root or DSD template content)
   */
  const injectStyles = (container: TBaseElement, styles: string | string[]) => {
    const styleArray = Array.isArray(styles) ? styles : [styles];
    for (const css of styleArray) {
      // Use adapter to create style element for portability
      const style = adapter.createNode('style' as keyof TConfig['nodes'] & string);
      adapter.setAttribute(style, 'textContent', css);
      adapter.appendChild(container, style);
    }
  };

  /**
   * Create a RefSpec for shadow fragments
   */
  const createShadowSpec = <TElement>(
    createFragmentFn: (svc: unknown) => FragmentRef<TBaseElement>
  ): RefSpec<TElement> => {
    const refSpec = {} as RefSpec<TElement>;

    refSpec.status = STATUS_REF_SPEC;
    refSpec.create = <TExt>(svc?: unknown, extensions?: TExt) => {
      const fragRef = createFragmentFn(svc);
      if (!extensions || Object.keys(extensions).length === 0) {
        return fragRef as FragmentRef<TElement> & TExt;
      }
      return {
        ...fragRef,
        ...extensions,
      } as FragmentRef<TElement> & TExt;
    };

    return refSpec;
  };

  /**
   * Create a ShadowFactory with accumulated options and callbacks
   */
  function createShadowBuilder(
    options: ShadowOptions,
    callbacks: ShadowLifecycleCallback[]
  ): ShadowFactory<TBaseElement> {
    const factory = (...children: ElRefSpecChild[]) => {
      return createShadowSpec<TBaseElement>((outerSvc) => {
        // Shadow fragments manage their own lifecycle via attach()
        void outerSvc;

        const fragment: FragmentRef<TBaseElement> = {
          status: STATUS_FRAGMENT,
          element: null,
          parent: null,
          prev: null,
          next: null,
          firstChild: null,
          lastChild: null,
          attach(
            parent: ElementRef<TBaseElement>,
            nextSibling: NodeRef<TBaseElement> | null,
            svc?: unknown
          ) {
            // Shadow content is appended to shadow root, not inserted at a position
            void nextSibling;
            void svc;

            // Get the host element from the parent ref
            const host = parent.element;
            if (!host) {
              console.warn('shadow: parent element not available');
              return;
            }

            const mode = options.mode ?? 'open';
            let container: TBaseElement;
            let shadowRoot: ShadowRoot | null = null;

            // Use adapter's createShadowRoot if available (for SSR/DSD support)
            // Track if this is an existing shadow root (from DSD hydration)
            let isExistingShadow = false;

            if (adapter.createShadowRoot) {
              const result = adapter.createShadowRoot(host, {
                mode,
                delegatesFocus: options.delegatesFocus,
              });
              container = result.container;
              shadowRoot = result.shadowRoot;

              // Check if shadow root already has content (from Declarative Shadow DOM)
              // If so, we're hydrating and should skip re-creating content
              if (shadowRoot && shadowRoot.childNodes.length > 0) {
                isExistingShadow = true;
              }
            } else {
              // Fallback to native attachShadow for DOM
              if (!(host instanceof Element)) {
                console.warn('shadow: host is not an Element');
                return;
              }
              shadowRoot = host.attachShadow({
                mode,
                delegatesFocus: options.delegatesFocus,
              });
              container = shadowRoot as unknown as TBaseElement;
            }

            // Execute lifecycle callbacks (only if we have a real shadow root)
            if (shadowRoot) {
              for (const callback of callbacks) {
                const cleanup = callback(shadowRoot);
                if (cleanup) onCleanup(cleanup);
              }
            }

            // During DSD hydration, shadow root already has content - skip re-creating
            if (isExistingShadow) {
              // Content already rendered by server, just return
              return () => {
                // Children cleanup handled by scope disposal
              };
            }

            // Inject styles into the container (only for fresh shadow roots)
            if (options.styles) {
              injectStyles(container, options.styles);
            }

            // Create an ElementRef-like wrapper for the container
            // This lets processChildren append to it
            const shadowRef: ElementRef<TBaseElement> = {
              status: STATUS_ELEMENT,
              element: container,
              parent: null,
              prev: null,
              next: null,
              firstChild: null,
              lastChild: null,
            };

            // Create context for children - they render into the container
            const childContext: ParentContext<TBaseElement> = {
              adapter,
              element: container,
            };

            // Process children into the shadow root/container
            processChildren(shadowRef, children, svc, childContext);

            // Copy child references to fragment for tracking
            fragment.firstChild = shadowRef.firstChild;
            fragment.lastChild = shadowRef.lastChild;

            // Return cleanup - shadow root is automatically removed when host is removed
            return () => {
              // Children cleanup handled by scope disposal
            };
          },
        };

        return fragment;
      });
    };

    // Add .props() method
    factory.props = (
      optsOrFn: ShadowOptions | ((current: ShadowOptions) => ShadowOptions)
    ): ShadowFactory<TBaseElement> => {
      const newOpts =
        typeof optsOrFn === 'function'
          ? optsOrFn(options)
          : { ...options, ...optsOrFn };
      return createShadowBuilder(newOpts, callbacks);
    };

    // Add .ref() method
    factory.ref = (
      ...newCallbacks: ShadowLifecycleCallback[]
    ): ShadowFactory<TBaseElement> => {
      return createShadowBuilder(options, [...callbacks, ...newCallbacks]);
    };

    return factory;
  }

  // Main shadow function
  function shadow(options: ShadowOptions = {}): ShadowFactory<TBaseElement> {
    return createShadowBuilder(options, []);
  }

  return shadow;
}

/**
 * Create a Shadow module for a given adapter.
 *
 * @example
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { createShadowModule } from '@rimitive/view/shadow';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 *
 * const adapter = createDOMAdapter();
 * const ShadowModule = createShadowModule(adapter);
 *
 * const { shadow, el } = compose(ElModule, ShadowModule);
 *
 * el('div')(
 *   shadow({ mode: 'open', styles: css })(
 *     el('p')('Isolated content')
 *   )
 * )
 * ```
 */
export const createShadowModule = <TConfig extends TreeConfig>(
  adapter: Adapter<TConfig>
): Module<'shadow', ShadowService<NodeOf<TConfig>>, { scopes: CreateScopes }> =>
  defineModule({
    name: 'shadow',
    dependencies: [ScopesModule],
    create: ({ scopes }: { scopes: CreateScopes }) =>
      createShadowFactory({
        adapter,
        ...scopes,
      }),
  });

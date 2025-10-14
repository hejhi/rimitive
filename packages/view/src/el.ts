import type { LatticeExtension } from '@lattice/lattice';
import type {
  ElementSpec,
  ElementProps,
  ElementChild,
  ReactiveElement,
  LifecycleCallback,
  ElementRef,
} from './types';
import { isReactive, isReactiveList, isElementRef } from './types';
import { createScope, runInScope, disposeScope, trackInScope } from './helpers/scope';
import type { ViewContext } from './context';
import {
  elementScopes,
  elementDisposeCallbacks,
  elementLifecycleCallbacks,
  elementCleanupCallbacks,
} from './helpers/element-metadata';

/**
 * Options passed to el factory
 */
export type ElOpts = {
  ctx: ViewContext;
  effect: (fn: () => void | (() => void)) => () => void;
};

/**
 * Factory return type
 */
export type ElFactory = LatticeExtension<
  'el',
  (spec: ElementSpec) => ElementRef
>;

/**
 * Create the el primitive factory
 */
export function createElFactory(opts: ElOpts): ElFactory {
  const { ctx, effect } = opts;

  function el(spec: ElementSpec): ElementRef {
    const [tag, ...rest] = spec;

    // Parse props and children from rest
    const { props, children } = parseSpec(rest);

    // Create the DOM element
    const element = document.createElement(tag) as ReactiveElement;

    // Create a minimal disposal scope
    const scope = createScope();

    // Run all reactive setup within this scope
    runInScope(ctx, scope, () => {
      // Apply props
      applyProps(element, props, effect, ctx);

      // Handle children
      for (const child of children) {
        handleChild(element, child, effect, ctx);
      }
    });

    // Store scope in WeakMap
    elementScopes.set(element, scope);

    // Store dispose callback
    elementDisposeCallbacks.set(element, () => {
      disposeScope(scope);

      // Call cleanup callback if registered
      const cleanup = elementCleanupCallbacks.get(element);
      if (cleanup) {
        cleanup();
        elementCleanupCallbacks.delete(element);
      }
    });

    // Create the element ref - a callable function that holds the element
    const ref = ((lifecycleCallback: LifecycleCallback): HTMLElement => {
      // Store lifecycle callback
      elementLifecycleCallbacks.set(element, lifecycleCallback);

      // Observe element connection to DOM
      observeConnection(element, lifecycleCallback);

      return element;
    }) as ElementRef;

    // Attach element to ref so it can be extracted
    ref.element = element;

    return ref;
  }

  return {
    name: 'el',
    method: el,
  };
}

/**
 * Parse element spec into props and children
 */
function parseSpec(rest: (ElementProps | ElementChild)[]): {
  props: ElementProps;
  children: ElementChild[];
} {
  const props: ElementProps = {};
  const children: ElementChild[] = [];

  for (const item of rest) {
    if (isPlainObject(item) && !isReactive(item) && !isReactiveList(item)) {
      // It's props
      Object.assign(props, item);
    } else {
      // It's a child
      children.push(item);
    }
  }

  return { props, children };
}

/**
 * Apply props to element (with reactivity)
 */
function applyProps(
  element: HTMLElement,
  props: ElementProps,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext
): void {
  for (const [key, value] of Object.entries(props)) {
    // Handle event listeners
    if (key.startsWith('on')) {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
      continue;
    }

    // Handle reactive values
    if (isReactive(value)) {
      const dispose = effect(() => {
        Reflect.set(element, key, value());
      });
      // Track effect for cleanup when element is removed
      trackInScope(ctx, { dispose });
    } else {
      // Static value
      Reflect.set(element, key, value);
    }
  }
}

/**
 * Handle a single child (static, reactive, or reactive list)
 */
function handleChild(
  element: HTMLElement,
  child: ElementChild,
  effect: (fn: () => void | (() => void)) => () => void,
  ctx: ViewContext
): void {
  // Skip null/undefined/false
  if (child == null || child === false) {
    return;
  }

  // Element ref (from el() or elMap())
  if (isElementRef(child)) {
    element.appendChild(child.element);
    return;
  }

  // Reactive list (elMap result)
  if (isReactiveList(child)) {
    // The reactive list contains a container element
    // that will be managed by elMap's effect
    if (child.__container) {
      element.appendChild(child.__container);
    }
    return;
  }

  // Reactive value (signal or computed)
  if (isReactive(child)) {
    const textNode = document.createTextNode('');
    const dispose = effect(() => {
      const value = child();
      textNode.textContent = String(value ?? '');
    });
    // Track effect for cleanup when element is removed
    trackInScope(ctx, { dispose });
    element.appendChild(textNode);
    return;
  }

  // HTMLElement (direct DOM node)
  if (child && typeof child === 'object' && 'nodeType' in child && child.nodeType === 1) {
    element.appendChild(child as Node);
    return;
  }

  // Static primitive (string, number)
  if (typeof child === 'string' || typeof child === 'number') {
    element.appendChild(document.createTextNode(String(child)));
    return;
  }

  // Boolean - ignore
  if (typeof child === 'boolean') {
    return;
  }
}

/**
 * Check if value is a plain object (not a class instance, array, etc.)
 */
function isPlainObject(value: any): value is Record<string, any> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Observe when an element is connected to and disconnected from the DOM
 */
function observeConnection(
  element: ReactiveElement,
  lifecycleCallback: LifecycleCallback
): void {
  // If already connected, call immediately
  if (element.isConnected) {
    const cleanup = lifecycleCallback(element);
    if (cleanup) {
      elementCleanupCallbacks.set(element, cleanup);
    }
    return;
  }

  // Otherwise, wait for connection using MutationObserver
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const addedNodes = Array.from(mutation.addedNodes);
      for (const node of addedNodes) {
        if (node === element || (node instanceof Element && node.contains(element))) {
          // Element was connected
          const cleanup = lifecycleCallback(element);
          if (cleanup) {
            elementCleanupCallbacks.set(element, cleanup);
          }

          // Now observe for disconnection
          observeDisconnection(element);

          // Stop observing for connection
          observer.disconnect();
          return;
        }
      }
    }
  });

  // Observe the entire document for additions
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Observe when an element is disconnected from the DOM
 */
function observeDisconnection(element: ReactiveElement): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const removedNodes = Array.from(mutation.removedNodes);
      for (const node of removedNodes) {
        if (node === element || (node instanceof Element && node.contains(element))) {
          // Element was disconnected - call dispose callback
          const dispose = elementDisposeCallbacks.get(element);
          if (dispose) {
            dispose();
          }

          // Stop observing
          observer.disconnect();
          return;
        }
      }
    }
  });

  // Observe the document for removals
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
}

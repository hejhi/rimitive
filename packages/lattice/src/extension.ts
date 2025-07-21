/**
 * @fileoverview Lattice extension system
 * 
 * Provides a unified interface for all lattice functionality through extensions.
 * This allows optimal tree-shaking and easy extensibility.
 */

/**
 * Context provided to extensions for lifecycle management
 */
export interface ExtensionContext {
  /**
   * Register a cleanup function to be called when context is disposed
   */
  onDispose(cleanup: () => void): void;
  
  /**
   * Track a resource for debugging and cleanup
   */
  track<T>(resource: T, type: string): T;
  
  /**
   * Check if the context has been disposed
   */
  readonly isDisposed: boolean;
}

/**
 * Base interface for all lattice extensions
 */
export interface LatticeExtension<TName extends string, TMethod> {
  /**
   * Unique name for this extension (becomes the method name on context)
   */
  name: TName;
  
  /**
   * The actual implementation
   */
  method: TMethod;
  
  /**
   * Optional wrapper to add context awareness (disposal checks, tracking, etc.)
   */
  wrap?(method: TMethod, context: ExtensionContext): TMethod;
  
  /**
   * Called when the extension is added to a context
   */
  onCreate?(context: ExtensionContext): void;
  
  /**
   * Called when the context is disposed
   */
  onDispose?(context: ExtensionContext): void;
}

/**
 * Helper type to extract the method type from an extension
 */
export type ExtensionMethod<E> = E extends LatticeExtension<string, infer M> ? M : never;

/**
 * Helper type to extract the name from an extension
 */
export type ExtensionName<E> = E extends LatticeExtension<infer N, unknown> ? N : never;

/**
 * Convert a tuple of extensions into a context type
 */
export type ExtensionsToContext<E extends readonly LatticeExtension<string, unknown>[]> = {
  [K in E[number] as ExtensionName<K>]: ExtensionMethod<K>;
} & {
  dispose(): void;
};

/**
 * Internal state for extension context
 */
interface ContextState {
  disposed: boolean;
  disposers: Set<() => void>;
  resources: Map<unknown, string>;
}

/**
 * Create a lattice context from a set of extensions
 */
export function createContext<E extends readonly LatticeExtension<string, unknown>[]>(
  ...extensions: E
): ExtensionsToContext<E> {
  const state: ContextState = {
    disposed: false,
    disposers: new Set(),
    resources: new Map(),
  };

  const extensionContext: ExtensionContext = {
    onDispose(cleanup: () => void): void {
      state.disposers.add(cleanup);
    },
    
    track<T>(resource: T, type: string): T {
      state.resources.set(resource, type);
      return resource;
    },
    
    get isDisposed(): boolean {
      return state.disposed;
    }
  };

  // Build the context object
  const context = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      // Call extension cleanup first
      for (const ext of extensions) {
        ext.onDispose?.(extensionContext);
      }

      // Then call all registered disposers
      for (const disposer of state.disposers) {
        disposer();
      }
      state.disposers.clear();

      // Clear tracked resources
      state.resources.clear();
    }
  } as ExtensionsToContext<E>;

  // Add each extension's method to the context
  for (const ext of extensions) {
    // Call onCreate lifecycle
    ext.onCreate?.(extensionContext);

    // Add the method (wrapped if wrapper provided)
    const method = ext.wrap 
      ? ext.wrap(ext.method, extensionContext)
      : ext.method;
    
    // Safe because we control the context type
    (context as Record<string, unknown>)[ext.name] = method;
  }

  return context;
}
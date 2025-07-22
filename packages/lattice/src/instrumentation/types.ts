/**
 * Instrumentation provider system types
 */

/**
 * Event emitted by instrumented extensions
 */
export interface InstrumentationEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  contextId?: string;
}

/**
 * Instrumentation provider interface
 * 
 * Providers implement this interface to handle instrumentation events
 * from Lattice extensions. Multiple providers can be composed together.
 */
export interface InstrumentationProvider {
  /**
   * Unique name for this provider
   */
  name: string;
  
  /**
   * Initialize the provider for a new context
   */
  init(contextId: string, contextName: string): void;
  
  /**
   * Handle an instrumentation event
   */
  emit(event: InstrumentationEvent): void;
  
  /**
   * Register a resource for tracking
   */
  register<T>(resource: T, type: string, name?: string): { id: string; resource: T };
  
  /**
   * Clean up resources when context is disposed
   */
  dispose?(): void;
}

/**
 * Configuration for instrumentation
 */
export interface InstrumentationConfig {
  /**
   * List of providers to use
   */
  providers: InstrumentationProvider[];
  
  /**
   * Whether instrumentation is enabled
   * Can be a boolean or a function that returns a boolean for dynamic enabling
   */
  enabled?: boolean | (() => boolean);
  
  /**
   * Optional context name
   */
  contextName?: string;
}
/**
 * @fileoverview Type definitions for Lattice DevTools
 */

/**
 * Options for configuring DevTools
 */
export interface DevToolsOptions {
  /** Name for the app/context */
  name?: string;
  
  /** Enable tracking of signal reads */
  trackReads?: boolean;
  
  /** Enable tracking of computed executions */
  trackComputations?: boolean;
  
  /** Maximum number of events to buffer */
  maxEvents?: number;
  
  /** Enable performance profiling */
  enableProfiling?: boolean;
}

/**
 * DevTools event types
 */
export type DevToolsEventType =
  | 'CONTEXT_CREATED'
  | 'CONTEXT_DISPOSED'
  | 'SIGNAL_CREATED'
  | 'SIGNAL_READ'
  | 'SIGNAL_WRITE'
  | 'COMPUTED_CREATED'
  | 'COMPUTED_START'
  | 'COMPUTED_END'
  | 'EFFECT_CREATED'
  | 'EFFECT_START'
  | 'EFFECT_END'
  | 'EFFECT_DISPOSED'
  | 'BATCH_START'
  | 'BATCH_END';

/**
 * Base event structure
 */
export interface DevToolsEvent {
  type: DevToolsEventType;
  contextId: string;
  timestamp: number;
  data?: unknown;
}

/**
 * Context event data
 */
export interface ContextEventData {
  id: string;
  name: string;
}

/**
 * Signal event data
 */
export interface SignalEventData {
  id: string;
  name?: string;
  value?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  initialValue?: unknown;
}

/**
 * Computed event data
 */
export interface ComputedEventData {
  id: string;
  name?: string;
  duration?: number;
  value?: unknown;
}

/**
 * Effect event data
 */
export interface EffectEventData {
  id: string;
  name?: string;
  duration?: number;
  hasCleanup?: boolean;
}

/**
 * Batch event data
 */
export interface BatchEventData {
  id: string;
  success?: boolean;
  error?: string;
}

/**
 * DevTools API exposed on window
 */
export interface DevToolsAPI {
  enabled: boolean;
  version: string;
  
  /** Get all buffered events */
  getEvents(): DevToolsEvent[];
  
  /** Clear event buffer */
  clearEvents(): void;
  
  /** Get all contexts */
  getContexts(): Array<{ id: string; name: string; created: number }>;
  
  /** Check if recording is active */
  isRecording(): boolean;
  
  /** Start recording events */
  startRecording(): void;
  
  /** Stop recording events */
  stopRecording(): void;
}

/**
 * Global window extension for DevTools
 */
declare global {
  interface Window {
    __LATTICE_DEVTOOLS__?: DevToolsAPI;
  }
}
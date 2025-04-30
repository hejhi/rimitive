// Helper type for defineGetState to ensure the return type is properly typed
export interface TypedGetState<T> {
  getState: () => T;
}

/**
 * Helper function to create a typed getState function for testing
 *
 * @param obj The object to create a getState function for
 * @returns A typed getState function
 */
export function defineGetState<T>(obj: T): TypedGetState<T> {
  return {
    getState: () => obj,
  };
}

// Common types for our tests
export interface User {
  id: number | string;
  name: string;
  [key: string]: any; // Allow additional properties
}

export interface Task {
  id: number | string;
  title: string;
  assignedTo: number | string;
  [key: string]: any; // Allow additional properties
}

export interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export interface TimerState {
  time: number;
  intervalId?: NodeJS.Timeout | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

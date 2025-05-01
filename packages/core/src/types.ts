import { StoreApi } from 'zustand';

/**
 * A function that creates state with set, get, and api parameters
 * This matches Zustand's StateCreator signature
 */
export type StateCreator<T> = (
  setState: StoreApi<T>['setState'],
  getState: StoreApi<T>['getState'],
  store: StoreApi<T>
) => T;

/**
 * Function to get current state
 */
export type GetState<T> = () => T;

/**
 * Interface for the hooks system
 */
export interface HooksInterface {
  before: (method: string, callback: Function) => void;
  after: (method: string, callback: Function) => void;
}

/**
 * The hooks system for intercepting API method calls
 */
export interface HooksSystem extends HooksInterface {
  _beforeHooks: Record<string, Function[]>;
  _afterHooks: Record<string, Function[]>;
  remove: (
    type: 'before' | 'after',
    method: string,
    callback: Function
  ) => void;
  executeBefore: (method: string, ...args: any[]) => any;
  executeAfter: (method: string, result: any, ...args: any[]) => any;
}

/**
 * Store with hooks system
 */
export type StoreWithHooks<T> = T & { _hooks: HooksSystem };

/**
 * Result of createAPI function
 */
export interface CreateAPIResult<T> {
  api: StoreApi<StoreWithHooks<T>>;
  hooks: HooksInterface;
}

/**
 * Type for a selector function when syncing multiple stores
 */
export type StoreStateSelector<
  S extends Record<string, StoreApi<any>>,
  T extends object,
> = (storesState: { [K in keyof S]: ReturnType<S[K]['getState']> }) => T;

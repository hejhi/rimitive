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

// ---- Hooks System Types ----

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
 * Base state for API store with hooks system
 */
export type BaseState = { _hooks: HooksSystem };

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

// ---- Props System Types ----

/**
 * Interface for a props configuration
 */
export interface PropsConfig<P = unknown> {
  get: (params: P) => Record<string, unknown>;
}

/**
 * Interface for a props store state
 */
export interface PropsState<P = unknown> {
  partName: string;
  get: (params: P) => Record<string, unknown>;
}

/**
 * Type for a props store with partName metadata
 */
export type PropsStore<P = unknown> = StoreApi<PropsState<P>> & {
  partName: string;
};

/**
 * Type for the config function in withProps
 */
export type PropsConfigCreator<P> = (
  set: StoreApi<PropsState<P>>['setState'],
  get: StoreApi<PropsState<P>>['getState'],
  baseProps: PropsState<P>
) => PropsConfig<P>;

// ---- Lattice Types ----

/**
 * Type for a lattice with props
 */
export interface LatticeWithProps {
  props: Record<string, PropsStore>;
}

/**
 * Base API interface for lattice
 */
export interface LatticeAPI {
  getState: () => Record<string, unknown>;
  setState?: (state: Record<string, unknown>) => void;
}

/**
 * Base hooks interface for lattice
 */
export interface LatticeHooks extends HooksInterface {
  [key: string]: unknown;
}

/**
 * Lattice configuration object interface
 */
export interface LatticeConfig {
  api?: LatticeAPI;
  hooks?: LatticeHooks;
  props?: Record<string, PropsStore>;
  use?: (plugin: (lattice: Lattice) => Lattice) => Lattice;
  [key: string]: unknown;
}

/**
 * Lattice object interface
 */
export interface Lattice {
  name: string;
  api: LatticeAPI;
  hooks: LatticeHooks;
  props: Record<string, PropsStore>;
  use: (plugin: (lattice: Lattice) => Lattice) => Lattice;
  [key: string]: unknown;
}

// ---- Store Sync Types ----

/**
 * Type for a selector function when syncing multiple stores
 */
export type StoreStateSelector<
  S extends Record<string, StoreApi<any>>,
  T extends object,
> = (storesState: { [K in keyof S]: ReturnType<S[K]['getState']> }) => T;

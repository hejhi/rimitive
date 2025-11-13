/**
 * Types for data islands
 */

/**
 * Data island HOC - wraps a component to inject fetched data
 */
export type DataIslandHOC<TData> = <TComponent extends (...args: any[]) => any>(
  factory: (data: TData, get: () => Promise<TData>) => TComponent
) => TComponent;

/**
 * Data fetcher function
 */
export type DataFetcher<TData> = () => Promise<TData>;

/**
 * Serialized data registry state
 */
export type SerializedData = Record<string, unknown>;

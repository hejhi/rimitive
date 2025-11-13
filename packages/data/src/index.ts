/**
 * @lattice/data - Data islands for SSR
 *
 * Provides automatic server-side data fetching and client-side hydration
 * through a simple HOC pattern.
 */

export { createData } from './createData';
export { getRegistry, initializeRegistry } from './registry';
export type { DataIslandHOC, DataFetcher, SerializedData } from './types';

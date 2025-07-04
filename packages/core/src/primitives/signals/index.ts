// Export raw signal APIs for direct usage and benchmarking
// These bypass the component layer entirely for maximum performance

import { createSignalFactory } from './lattice-integration';

// Create a global factory instance for raw signal usage
const globalFactory = createSignalFactory();

// Export raw signal APIs
export const signal = globalFactory.signal;
export const computed = globalFactory.computed;
export const effect = globalFactory.effect;
export const batch = globalFactory.batch;
export const set = globalFactory.set;

// Export types
export type { Signal, Computed } from '../../component/types';
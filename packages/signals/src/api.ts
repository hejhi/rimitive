/**
 * Signals API creation
 *
 * Re-exports createApi from @lattice/lattice as createSignalAPI for convenience.
 * This maintains backward compatibility while using the shared implementation.
 */

import { createApi, type ExtensionFactory } from '@lattice/lattice';

// Re-export as createSignalAPI for signals-specific naming
export const createSignalAPI = createApi;

// Re-export ExtensionFactory for creating custom signal primitives
export type { ExtensionFactory };

// Type exports for users who want to create custom primitives
export type { GlobalContext } from './context';

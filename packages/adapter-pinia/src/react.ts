/**
 * @fileoverview React hooks for Pinia adapter
 * 
 * Re-exports the core React hooks which work with any Lattice adapter,
 * including Pinia. This provides a convenient import path for React users
 * of the Pinia adapter.
 */

export {
  useSliceSelector,
  useSlice,
  useSliceValues,
  useLattice,
} from '@lattice/runtime/react';
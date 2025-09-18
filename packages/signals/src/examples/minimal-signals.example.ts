/**
 * Example: Creating a minimal signals-only context
 *
 * This example shows how to use graph-traversal instead of the full scheduler
 * for a lighter-weight signals implementation without effects or automatic flushing.
 */

import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createBaseContext } from '../context';
import { createGraphEdges } from '../helpers/graph-edges';
import { createGraphTraversal } from '../helpers/graph-traversal';
import { createPullPropagator } from '../helpers/pull-propagator';
import { createContext as createLattice } from '@lattice/lattice';

// Create a minimal context with just propagation, no scheduling
function createMinimalSignalsContext() {
  const ctx = createBaseContext();
  const graphEdges = createGraphEdges();

  // Use lightweight propagate without scheduling/flushing
  const context = {
    ctx,
    ...graphEdges,
    ...createPullPropagator(ctx, graphEdges),
    ...createGraphTraversal(),
  };

  // Create just signals and computed - no effects or batching
  const signalExt = createSignalFactory(context);
  const computedExt = createComputedFactory(context);

  return createLattice(signalExt, computedExt);
}

// Usage example
export function minimalExample() {
  const api = createMinimalSignalsContext();

  const count = api.signal(0);
  const double = api.computed(() => count() * 2);
  const quadruple = api.computed(() => double() * 2);

  console.log(quadruple()); // 0

  count(5);
  console.log(quadruple()); // 20

  // No effects, no automatic flushing - just pure reactive values
  // This is lighter weight and more suitable for scenarios where
  // you only need reactive state without side effects.
}
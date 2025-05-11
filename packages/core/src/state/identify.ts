import { brandWithSymbol } from '../shared/identify';
import { STATE_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice state
 *
 * @param value The value to mark as a Lattice state
 */
export function markAsLatticeState(value) {
  return brandWithSymbol(value, STATE_INSTANCE_BRAND);
}

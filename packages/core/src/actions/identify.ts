import { brandWithSymbol } from '../shared/identify';
import { ACTIONS_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice action
 *
 * @param value The value to mark as a Lattice action
 */
export function markAsLatticeAction(value) {
  return brandWithSymbol(value, ACTIONS_INSTANCE_BRAND);
}

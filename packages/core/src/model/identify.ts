import { brandWithSymbol } from '../shared/identify';
import { MODEL_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice model
 *
 * @param value The value to mark as a Lattice model
 */
export function markAsLatticeModel(value) {
  return brandWithSymbol(value, MODEL_INSTANCE_BRAND);
}

/**
 * Bit Flag Status Constants
 *
 * The status field combines two types of flags:
 * - State flags (bits 0-2): Mutable, represent current lifecycle state
 * - Type flags (bits 6-8): Immutable, set at creation to identify node type
 *
 * This allows single-field access for both type checking and state management.
 * Node type + state combination provides full semantic meaning:
 * - DIRTY + PRODUCER (signal) = signal updated
 * - DIRTY + PRODUCER + CONSUMER (computed) = computed dirty
 * - PENDING + CONSUMER + SCHEDULED (effect) = effect pending
 * - DISPOSED + SCHEDULED (effect) = effect disposed
 */

// === State Flags (bits 0-2, mutable) ===
export const CLEAN = 0;
export const PENDING = 1 << 0;
export const DIRTY = 1 << 1;
export const DISPOSED = 1 << 2;

// === Type Flags (bits 6-8, immutable) ===
export const PRODUCER = 1 << 6;  // Can be depended on (signals, computeds)
export const CONSUMER = 1 << 7;  // Depends on others (computeds, effects)
export const SCHEDULED = 1 << 8;  // Scheduled node (effects)

// === Masks ===
export const STATE_MASK = 0b00000111;    // Bits 0-2
export const TYPE_MASK = 0b111000000;    // Bits 6-8

// Re-export as CONSTANTS
export const CONSTANTS = {
  // State flags
  CLEAN,
  PENDING,
  DIRTY,
  DISPOSED,
  // Type flags
  PRODUCER,
  CONSUMER,
  SCHEDULED,
  // Masks
  STATE_MASK,
  TYPE_MASK,
};
/**
 * Optimized State Machine Flag System
 * 
 * Direct bit operations for maximum performance while maintaining
 * mutually exclusive states and combinable properties.
 */

// Node Status (mutually exclusive - a node can only be in one status)
// Status values (STATUS_ prefix for clarity)
export const STATUS_CLEAN         = 0;      // No status flags - up to date and ready
export const STATUS_INVALIDATED   = 1 << 0; // Dependencies might have changed, needs checking
export const STATUS_DIRTY         = 1 << 1; // Definitely needs recomputation
export const STATUS_CHECKING      = 1 << 2; // Currently checking staleness (replaces RUNNING for stale checks)
export const STATUS_RECOMPUTING   = 1 << 3; // Currently recomputing value (replaces RUNNING for computations)
export const STATUS_DISPOSED      = 1 << 4; // Node is dead and should be ignored

// Node Properties (can combine with states)
// Properties (IS_/HAS_ prefixes for clarity)
export const HAS_CHANGED    = 1 << 5; // Value changed on last recomputation
export const IS_SCHEDULED   = 1 << 6; // Node is in the work queue

// Status masks for efficient checking
export const STATUS_MASK = STATUS_INVALIDATED | STATUS_DIRTY | STATUS_CHECKING | STATUS_RECOMPUTING | STATUS_DISPOSED;
export const NEEDS_UPDATE = STATUS_INVALIDATED | STATUS_DIRTY;
export const IS_PROCESSING = STATUS_CHECKING | STATUS_RECOMPUTING;
export const SKIP_NODE = STATUS_DISPOSED | IS_PROCESSING;

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  STATUS_INVALIDATED,
  STATUS_DIRTY,
  STATUS_CHECKING,
  STATUS_RECOMPUTING,
  STATUS_DISPOSED,
  HAS_CHANGED,
  IS_SCHEDULED,
  STATUS_MASK,
  NEEDS_UPDATE,
  IS_PROCESSING,
  SKIP_NODE,
};

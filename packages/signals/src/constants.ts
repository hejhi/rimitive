/**
 * Streamlined State Machine Flag System
 * 
 * Simplified from 5 to 3 states plus disposed for better performance
 * on deep chain benchmarks. Reduces branch prediction complexity.
 */

// Node Status (mutually exclusive - a node can only be in one status)
// Status values (STATUS_ prefix for clarity)
export const STATUS_CLEAN         = 0;      // No status flags - up to date and ready
export const STATUS_PENDING       = 1 << 0; // Dependencies might have changed, needs checking (was INVALIDATED)
export const STATUS_DIRTY         = 1 << 1; // Definitely needs recomputation
export const STATUS_DISPOSED      = 1 << 2; // Node is dead and should be ignored

// Legacy aliases for backward compatibility during transition
export const STATUS_INVALIDATED   = STATUS_PENDING;   // Alias for PENDING
export const STATUS_CHECKING      = 1 << 3; // Deprecated - use simple recursion flag
export const STATUS_RECOMPUTING   = 1 << 4; // Deprecated - use simple recursion flag

// Node Properties (can combine with states)
// Properties (IS_/HAS_ prefixes for clarity)
export const HAS_CHANGED  = 1 << 5; // Value changed on last recomputation
export const IS_SCHEDULED = 1 << 6; // Node is in the work queue

// Status masks for efficient checking - updated for simplified states
export const MASK_STATUS = STATUS_PENDING | STATUS_DIRTY | STATUS_DISPOSED;
export const MASK_STATUS_AWAITING = STATUS_PENDING | STATUS_DIRTY;
export const MASK_STATUS_PROCESSING = 0; // Deprecated - no longer needed
export const MASK_STATUS_SKIP_NODE = STATUS_DISPOSED | STATUS_CHECKING; // Include legacy checking for backward compatibility

// Legacy masks for backward compatibility
export const MASK_STATUS_LEGACY = STATUS_INVALIDATED | STATUS_DIRTY | STATUS_CHECKING | STATUS_RECOMPUTING | STATUS_DISPOSED;
export const MASK_STATUS_PROCESSING_LEGACY = STATUS_CHECKING | STATUS_RECOMPUTING;

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  STATUS_PENDING,
  STATUS_INVALIDATED, // Alias for STATUS_PENDING
  STATUS_DIRTY,
  STATUS_CHECKING, // Deprecated
  STATUS_RECOMPUTING, // Deprecated
  STATUS_DISPOSED,
  HAS_CHANGED,
  IS_SCHEDULED,
  MASK_STATUS,
  MASK_STATUS_AWAITING,
  MASK_STATUS_PROCESSING,
  MASK_STATUS_SKIP_NODE,
};

export function createFlagManager() {
  const getStatus = (flags: number) => flags & MASK_STATUS;
  const addProperty = (flags: number, prop: number) => flags | prop;
  const removeProperty = (flags: number, prop: number) => flags & ~prop;
  const hasAnyOf = (flags: number, flag: number) => !!(flags & flag);

  const resetStatus = (flags: number) => removeProperty(flags, MASK_STATUS); // STATUS_CLEAN is 0, so just clear status bits
  const setStatus = (flags: number, status: number) => removeProperty(flags, MASK_STATUS) | status;

  return {
    getStatus,
    setStatus,
    hasAnyOf,
    addProperty,
    removeProperty,
    resetStatus,
  };
}
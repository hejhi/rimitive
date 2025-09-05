/**
 * Streamlined State Machine Flag System
 * 
 * Simplified from 5 to 3 core states for better performance on deep chains.
 * Reduces branch prediction complexity and state transition overhead.
 */

// Node Status (mutually exclusive states)
export const STATUS_CLEAN    = 0;      // Up to date and ready
export const STATUS_PENDING  = 1 << 0; // Dependencies might have changed, needs checking
export const STATUS_DISPOSED = 1 << 1; // Node is dead and should be ignored

// Node Properties (can combine with states)
export const DIRTY        = 1 << 2; // Value changed (persists until consumed)
export const IS_SCHEDULED = 1 << 4; // Node is in the work queue

// Optimized status masks for core states only
export const MASK_STATUS = STATUS_PENDING | STATUS_DISPOSED;

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  STATUS_PENDING,
  STATUS_DISPOSED,
  DIRTY,
  IS_SCHEDULED,
  MASK_STATUS,
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
/**
 * Bit Flag Status Constants
 *
 * Status values are mutually exclusive (only one bit set at a time),
 * but bit flags allow efficient multi-state checks using bitwise AND.
 */

// Node Status (mutually exclusive states - power-of-2 bit flags)
export const STATUS_CLEAN = 0;           // Up to date and ready
export const STATUS_PENDING = 1 << 0;    // 1 - Dependencies might have changed, needs checking
export const STATUS_DIRTY = 1 << 1;      // 2 - Value changed (persists until consumed)
export const STATUS_SCHEDULED = 1 << 2;  // 4 - Node is scheduled
export const STATUS_DISPOSED = 1 << 3;   // 8 - Node is dead and should be ignored
export const STATUS_PRISTINE = 1 << 4;   // 16 - Never computed (initial state for derived nodes)

// Composite masks for efficient multi-state checks
export const NEEDS_PULL = STATUS_PENDING | STATUS_DIRTY | STATUS_PRISTINE;  // 19 - Needs pull update
export const FORCE_RECOMPUTE = STATUS_DIRTY | STATUS_PRISTINE;              // 18 - Forces recomputation

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  STATUS_PENDING,
  STATUS_DISPOSED,
  STATUS_DIRTY,
  STATUS_SCHEDULED,
  STATUS_PRISTINE,
  NEEDS_PULL,
  FORCE_RECOMPUTE,
};
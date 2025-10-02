/**
 * Bit Flag Status Constants
 *
 * Status values are mutually exclusive (only one bit set at a time),
 * but bit flags allow efficient multi-state checks using bitwise AND.
 */

// Node Status (mutually exclusive states - power-of-2 bit flags)
export const STATUS_CLEAN = 0;
export const CONSUMER_PENDING = 1 << 0;
export const DERIVED_DIRTY = 1 << 1;
export const SCHEDULED = 1 << 2;
export const SCHEDULED_DISPOSED = 1 << 3;
export const SIGNAL_UPDATED = 1 << 5;

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  CONSUMER_PENDING,
  SCHEDULED_DISPOSED,
  DERIVED_DIRTY,
  SCHEDULED,
  SIGNAL_UPDATED,
};
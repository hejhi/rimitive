/**
 * Simplified Status Constants
 *
 * Direct status values for 2x performance improvement over bit flags.
 * Status values are mutually exclusive - only one at a time.
 */

// Node Status (mutually exclusive states - use simple numbers)
export const STATUS_CLEAN = 0;    // Up to date and ready
export const STATUS_PENDING = 1;  // Dependencies might have changed, needs checking
export const STATUS_DISPOSED = 2; // Node is dead and should be ignored
export const STATUS_DIRTY = 3;    // Value changed (persists until consumed)

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  STATUS_PENDING,
  STATUS_DISPOSED,
  STATUS_DIRTY,
};
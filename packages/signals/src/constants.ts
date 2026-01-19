// === State Flags (bits 0-2) ===
export const CLEAN = 0;
export const PENDING = 1 << 0;
export const DIRTY = 1 << 1;
export const DISPOSED = 1 << 2;

// === Type Flags (bits 6-8) ===
export const PRODUCER = 1 << 6; // Can be depended on
export const CONSUMER = 1 << 7; // Depends on others
export const SCHEDULED = 1 << 8; // Scheduled node

// === Masks ===
export const STATE_MASK = PENDING | DIRTY | DISPOSED;
export const TYPE_MASK = PRODUCER | CONSUMER | SCHEDULED;

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

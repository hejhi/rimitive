/**
 * Bit Flag Status Constants
 *
 * The status field combines two types of flags:
 * - State flags (bits 0-5): Mutable, represent current lifecycle state
 * - Type flags (bits 6-8): Immutable, set at creation to identify node type
 *
 * This allows single-field access for both type checking and state management.
 */

// === State Flags (bits 0-5, mutable) ===
export const STATUS_CLEAN = 0;
export const CONSUMER_PENDING = 1 << 0;
export const DERIVED_DIRTY = 1 << 1;
export const SCHEDULED_PENDING = 1 << 2;  // Scheduled node is queued for flush
export const SCHEDULED_DISPOSED = 1 << 3;
export const SIGNAL_UPDATED = 1 << 5;

// === Type Flags (bits 6-8, immutable) ===
export const PRODUCER = 1 << 6;  // Can be depended on (signals, computeds)
export const CONSUMER = 1 << 7;  // Depends on others (computeds, effects)
export const SCHEDULED = 1 << 8;  // Scheduled node (effects)

// === Masks ===
export const STATE_MASK = 0b00111111;    // Bits 0-5
export const TYPE_MASK = 0b111000000;    // Bits 6-8

// === Status Helpers (preserve type bits when updating state) ===
import type { ReactiveNode } from './types';

export function setClean(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | STATUS_CLEAN;
}

export function setPending(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | CONSUMER_PENDING;
}

export function setDirty(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | DERIVED_DIRTY;
}

export function setScheduledPending(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | SCHEDULED_PENDING;
}

export function setScheduledDisposed(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | SCHEDULED_DISPOSED;
}

export function setSignalUpdated(node: ReactiveNode): void {
  node.status = (node.status & TYPE_MASK) | SIGNAL_UPDATED;
}

export function isScheduled(node: ReactiveNode): boolean {
  return !!(node.status & SCHEDULED);
}

export function isProducer(node: ReactiveNode): boolean {
  return !!(node.status & PRODUCER);
}

export function isConsumer(node: ReactiveNode): boolean {
  return !!(node.status & CONSUMER);
}

// State checking helpers
export function isClean(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === STATUS_CLEAN;
}

export function isPending(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === CONSUMER_PENDING;
}

export function isDirty(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === DERIVED_DIRTY;
}

export function isScheduledPending(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === SCHEDULED_PENDING;
}

export function isScheduledDisposed(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === SCHEDULED_DISPOSED;
}

export function isSignalUpdated(node: ReactiveNode): boolean {
  return (node.status & STATE_MASK) === SIGNAL_UPDATED;
}

// Re-export as CONSTANTS for backward compatibility
export const CONSTANTS = {
  STATUS_CLEAN,
  CONSUMER_PENDING,
  SCHEDULED_PENDING,
  SCHEDULED_DISPOSED,
  DERIVED_DIRTY,
  SCHEDULED,
  SIGNAL_UPDATED,
  PRODUCER,
  CONSUMER,
  STATE_MASK,
  TYPE_MASK,
};
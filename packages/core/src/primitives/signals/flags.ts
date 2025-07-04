/**
 * Readable flag helpers that compile to efficient bitwise operations
 * Hides the bitwise complexity while maintaining performance
 */

import { NOTIFIED, OUTDATED, RUNNING, DISPOSED, TRACKING, IS_COMPUTED } from './types';

// State checkers - readable names for bitwise checks
export const isNotified = (flags: number) => !!(flags & NOTIFIED);
export const isOutdated = (flags: number) => !!(flags & OUTDATED);
export const isRunning = (flags: number) => !!(flags & RUNNING);
export const isDisposed = (flags: number) => !!(flags & DISPOSED);
export const hasTracking = (flags: number) => !!(flags & TRACKING);
export const isComputed = (flags: number) => !!(flags & IS_COMPUTED);

// State setters - readable names for bitwise operations
export const setNotified = (flags: number) => flags | NOTIFIED;
export const setOutdated = (flags: number) => flags | OUTDATED;
export const setRunning = (flags: number) => flags | RUNNING;
export const setDisposed = (flags: number) => flags | DISPOSED;
export const setTracking = (flags: number) => flags | TRACKING;
export const setComputed = (flags: number) => flags | IS_COMPUTED;

// State clearers
export const clearNotified = (flags: number) => flags & ~NOTIFIED;
export const clearOutdated = (flags: number) => flags & ~OUTDATED;
export const clearRunning = (flags: number) => flags & ~RUNNING;
export const clearTracking = (flags: number) => flags & ~TRACKING;

// Combined operations for common patterns
export const markStale = (flags: number) => flags | NOTIFIED | OUTDATED;
export const markClean = (flags: number) => flags & ~(NOTIFIED | OUTDATED);
export const startRunning = (flags: number) => (flags | RUNNING) & ~NOTIFIED;
export const stopRunning = (flags: number) => flags & ~RUNNING;

// Check multiple states at once
export const canRun = (flags: number) => !(flags & (DISPOSED | RUNNING));
export const needsRecompute = (flags: number) => !!(flags & OUTDATED);
export const isClean = (flags: number) => !(flags & (NOTIFIED | OUTDATED));
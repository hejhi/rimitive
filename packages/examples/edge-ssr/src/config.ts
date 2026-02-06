/**
 * Shared configuration between worker and client
 */

/** Stream key for SSR streaming - must match on both sides */
export const STREAM_KEY = '__RIMITIVE_EDGE_STREAM__';

/** CSS selector for the app root element (must match what App component creates) */
export const APP_ROOT = '.container';

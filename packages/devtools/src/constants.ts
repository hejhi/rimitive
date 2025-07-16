/**
 * Constants and configuration values for Lattice DevTools
 */

// Event buffer configuration
export const MAX_EVENTS = 10000;
export const EVENT_BATCH_SIZE = 100;
export const FLUSH_INTERVAL = 16; // ~60fps

// Internal Lattice flags
export const FLAGS = {
  OUTDATED: 1 << 1,
  RUNNING: 1 << 2,
  DISPOSED: 1 << 3,
} as const;

// DevTools version
export const DEVTOOLS_VERSION = '1.0.0';

// ID prefixes for different primitive types
export const ID_PREFIXES = {
  CONTEXT: 'ctx',
  SIGNAL: 'sig',
  COMPUTED: 'comp',
  EFFECT: 'eff',
  SELECTOR: 'sel',
  BATCH: 'batch',
} as const;

// Selector string truncation length
export const SELECTOR_STRING_MAX_LENGTH = 50;

// Window key for DevTools API
export const DEVTOOLS_WINDOW_KEY = '__LATTICE_DEVTOOLS__';

// PostMessage source identifier
export const MESSAGE_SOURCE = 'lattice-devtools';
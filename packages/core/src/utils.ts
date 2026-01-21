/**
 * Shared utilities for Rimitive core
 *
 * @module
 */

/**
 * Safely call dispose on an object if it has a dispose method.
 * Used for cleanup of module instances during context disposal.
 */
export function tryDispose(obj: unknown): void {
  if (obj && typeof obj === 'object' && 'dispose' in obj) {
    const d = obj as { dispose?: unknown };
    if (typeof d.dispose === 'function') d.dispose();
  }
}

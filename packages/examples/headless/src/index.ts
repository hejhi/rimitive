/**
 * @lattice/headless
 *
 * Framework-agnostic, accessible headless UI behaviors.
 *
 * These behaviors work with any signals implementation that provides:
 * - signal<T>(initial) => Signal<T>
 * - computed<T>(fn) => Computed<T>
 * - effect(fn) => cleanup
 *
 * @example
 * ```ts
 * import { useDialog, useSelect } from '@lattice/headless';
 * import { signal, computed, effect } from '@lattice/signals';
 *
 * // Create behaviors with your signals implementation
 * const dialog = useDialog({ signal, computed, effect })();
 * const select = useSelect({ signal, computed, effect })({ options: [...] });
 * ```
 */

export { useDialog } from './useDialog';
export type { UseDialogOptions, DialogState } from './useDialog';

export { useSelect } from './useSelect';
export type { UseSelectOptions, SelectOption, SelectState } from './useSelect';

export type { SignalsApi, Signal, Computed } from './types';

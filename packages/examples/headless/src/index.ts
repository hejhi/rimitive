/**
 * @rimitive/headless
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
 * import { dialog, select } from '@rimitive/headless';
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule);
 *
 * // Create behaviors with your signals service
 * const myDialog = svc(dialog)();
 * const mySelect = svc(select)({ options: [...] });
 * ```
 */

export { dialog } from './dialog';
export type { DialogOptions, DialogState } from './dialog';

export { select } from './select';
export type { SelectOptions, SelectOption, SelectState } from './select';

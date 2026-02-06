/**
 * Status - Reactive loading state for PWAs
 *
 * Provides a signal-based status indicator that automatically
 * updates a DOM element when status changes.
 */

import type { SignalFactory, EffectFactory } from '@rimitive/signals/extend';
import type { Writable } from '@rimitive/signals';

export type Status = 'initializing' | 'loading' | 'ready' | 'error';

export type StatusService = Writable<Status>;

export type StatusOptions = {
  element: HTMLElement | string;
  initial?: Status;
};

/**
 * Create a reactive status indicator.
 */
export function createStatus(
  deps: { signal: SignalFactory; effect: EffectFactory },
  options: StatusOptions
): StatusService {
  const { signal, effect } = deps;
  const { element, initial = 'initializing' } = options;

  const el =
    typeof element === 'string'
      ? document.querySelector<HTMLElement>(element)
      : element;

  const status = signal<Status>(initial);

  // Sync status to DOM element
  if (el) {
    effect(() => {
      const current = status();
      el.textContent = current.charAt(0).toUpperCase() + current.slice(1);
      el.className = `status ${current}`;
    });
  }

  return status;
}

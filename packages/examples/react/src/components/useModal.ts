/**
 * useModal - Portable Modal Behavior
 *
 * Simple open/close state for modals.
 * Framework-agnostic - works with any signals implementation.
 *
 * For a more complete implementation with ARIA support, focus trapping,
 * and keyboard handling, see @lattice/headless useDialog.
 *
 * @example
 * ```ts
 * // With Lattice signals
 * const modal = useModal({ signal, computed, effect })();
 *
 * // With React (via createHook)
 * const useModalHook = createHook(useModal);
 * const modal = useModalHook();
 * ```
 */
import type { SignalsApi, Signal } from './types';

export interface ModalState {
  /** Whether the modal is open */
  isOpen: Signal<boolean>;

  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Toggle the modal */
  toggle: () => void;
}

/**
 * Creates a portable modal behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates modal state
 */
export const useModal =
  (api: SignalsApi) =>
  (): ModalState => {
    const { signal } = api;

    const isOpen = signal(false);

    return {
      isOpen,

      open: () => isOpen(true),
      close: () => isOpen(false),
      toggle: () => isOpen(!isOpen()),
    };
  };

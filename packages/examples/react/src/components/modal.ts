/**
 * Modal Component - Design System Pattern
 *
 * This component creates its own internal signal context,
 * completely isolated from other modal instances.
 * Similar to how Chakra UI components have encapsulated state.
 */

import type { SignalFunction } from '@lattice/signals/signal';

export interface ModalAPI {
  isOpen: SignalFunction<boolean>;
  open(): void;
  close(): void;
  toggle(): void;
}

export function createModal(api: {
  signal: <T>(value: T) => SignalFunction<T>;
}): ModalAPI {
  const isOpen = api.signal(false);

  return {
    isOpen,
    open: () => isOpen(true),
    close: () => isOpen(false),
    toggle: () => isOpen(!isOpen()),
  };
}

import type { SignalsSvc, Signal } from './types';

export type ModalState = {
  isOpen: Signal<boolean>;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const modal =
  ({ signal }: SignalsSvc) =>
  () => {
    const isOpen = signal(false);

    return {
      isOpen,

      open: () => isOpen(true),
      close: () => isOpen(false),
      toggle: () => isOpen(!isOpen()),
    };
  };

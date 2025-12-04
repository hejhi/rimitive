import type { SignalsApi, Signal } from './types';

export interface ModalState {
  isOpen: Signal<boolean>;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const modal = (api: SignalsApi) => (): ModalState => {
  const { signal } = api;

  const isOpen = signal(false);

  return {
    isOpen,

    open: () => isOpen(true),
    close: () => isOpen(false),
    toggle: () => isOpen(!isOpen()),
  };
};

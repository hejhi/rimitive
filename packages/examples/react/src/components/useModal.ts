/**
 * Modal Behavior - Design System Pattern
 *
 * Creates isolated signal state for each modal instance.
 * Used with useComponent to create isolated instances per React component.
 */
import type { Service } from '../service';

export const useModal = (api: Service) => {
  const isOpen = api.signal(false);

  return {
    // Reactive state
    isOpen,

    // Actions
    open: () => isOpen(true),
    close: () => isOpen(false),
    toggle: () => isOpen(!isOpen()),
  };
};

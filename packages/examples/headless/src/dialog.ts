/**
 * useDialog - Headless Dialog Behavior
 *
 * Example of framework-agnostic, accessible dialog (modal) behaviors.
 * Provides state management, ARIA attributes, keyboard handling, and focus management.
 */
import { Writable, Readable } from '@rimitive/signals/types';
import type { ReactiveSvc } from './types';

export type DialogOptions = {
  /** Whether the dialog starts open */
  initialOpen?: boolean;
  /** Called when dialog opens */
  onOpen?: () => void;
  /** Called when dialog closes */
  onClose?: () => void;
};

export type DialogState = {
  /** Whether the dialog is currently open */
  isOpen: Writable<boolean>;
  /** Open the dialog */
  open: () => void;
  /** Close the dialog */
  close: () => void;
  /** Toggle the dialog */
  toggle: () => void;

  /** Props to spread on the trigger element (button that opens dialog) */
  triggerProps: {
    'aria-haspopup': 'dialog';
    'aria-expanded': Readable<boolean>;
    onclick: () => void;
  };

  /** Props to spread on the dialog element */
  dialogProps: {
    role: 'dialog';
    'aria-modal': true;
    'aria-hidden': Readable<boolean>;
    onkeydown: (e: KeyboardEvent) => void;
    /** Ref callback to track dialog element for focus trapping */
    ref: (el: HTMLElement | null) => void;
  };

  /** Props to spread on an optional close button inside the dialog */
  closeButtonProps: {
    'aria-label': string;
    onclick: () => void;
  };
};

export const dialog =
  (svc: ReactiveSvc) =>
  (options: DialogOptions = {}): DialogState => {
    const { signal, computed, effect } = svc;
    const { initialOpen = false, onOpen, onClose } = options;

    // Core state
    const isOpen = signal(initialOpen);

    // Track the element that triggered the dialog for focus restoration
    let triggerElement: HTMLElement | null = null;

    // Track the dialog element for focus trapping
    let dialogElement: HTMLElement | null = null;

    const open = () => {
      // Capture the currently focused element before opening
      triggerElement = document.activeElement as HTMLElement | null;
      isOpen(true);
      onOpen?.();
    };

    const close = () => {
      isOpen(false);
      onClose?.();
      // Return focus to trigger element
      triggerElement?.focus();
      triggerElement = null;
    };

    const toggle = () => {
      if (isOpen()) {
        close();
      } else {
        open();
      }
    };

    // Handle keyboard events on the dialog
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      // Focus trapping with Tab
      if (e.key === 'Tab' && dialogElement) {
        const focusableElements = dialogElement.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (e.shiftKey) {
          // Shift+Tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Effect for focus management when dialog opens
    effect(() => {
      if (isOpen() && dialogElement) {
        // Focus the first focusable element or the dialog itself
        const firstFocusable = dialogElement.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          dialogElement.focus();
        }
      }
    });

    // Effect for body scroll lock
    effect(() => {
      if (isOpen()) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
      return undefined;
    });

    return {
      isOpen,
      open,
      close,
      toggle,

      triggerProps: {
        'aria-haspopup': 'dialog',
        'aria-expanded': computed(() => isOpen()),
        onclick: toggle,
      },

      dialogProps: {
        role: 'dialog',
        'aria-modal': true,
        'aria-hidden': computed(() => !isOpen()),
        onkeydown: handleKeydown,
        ref: (el: HTMLElement | null) => {
          dialogElement = el;
        },
      },

      closeButtonProps: {
        'aria-label': 'Close dialog',
        onclick: close,
      },
    };
  };

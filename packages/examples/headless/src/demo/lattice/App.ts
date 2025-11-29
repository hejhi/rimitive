/**
 * Lattice Demo - useDialog and useSelect with Lattice View rendering
 *
 * Demonstrates how the same headless behaviors work with Lattice's
 * native signals and view system.
 */
import { composeFrom } from '@lattice/lattice';
import {
  defaultExtensions,
  defaultHelpers as defaultViewHelpers,
} from '@lattice/view/presets/core';
import { createSignalsApi } from '@lattice/signals/presets/core';
import {
  createDOMRenderer,
  DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import type { RefSpec } from '@lattice/view/types';
import { useDialog } from '../../useDialog';
import { useSelect, type SelectOption } from '../../useSelect';

// ============================================================================
// Create Lattice API
// ============================================================================

const signalsSvc = createSignalsApi();
const viewHelpers = defaultViewHelpers(createDOMRenderer(), signalsSvc);
const viewSvc = composeFrom(
  defaultExtensions<DOMRendererConfig>(),
  viewHelpers
);
const svc = {
  ...signalsSvc,
  ...viewSvc,
};

const { el, signal, computed, effect } = svc;

// ============================================================================
// Demo Data
// ============================================================================

const selectOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date', disabled: true },
  { value: 'elderberry', label: 'Elderberry' },
];

// ============================================================================
// Dialog Demo
// ============================================================================

function createDialogDemo(): RefSpec<HTMLElement> {
  // Create headless dialog with Lattice signals
  const dialog = useDialog({ signal, computed, effect })({});

  // Dialog content element
  const dialogContent = el('div', {
    className: 'dialog-content',
    role: dialog.dialogProps.role,
    tabIndex: -1,
    ariaModal: 'true',
    ariaLabel: 'Dialog',
    onkeydown: dialog.dialogProps.onkeydown,
  })(
    el('h4')('Headless Dialog'),
    el('p')(
      'This dialog is built with the ',
      el('code')('useDialog'),
      ' headless behavior. It handles focus trapping, keyboard navigation (ESC to close), and returns focus to the trigger on close.'
    ),
    el('div', { className: 'dialog-actions' })(
      el('button', {
        className: 'dialog-close',
        onclick: dialog.closeButtonProps.onclick,
      })('Cancel'),
      el('button', {
        className: 'dialog-confirm',
        onclick: dialog.close,
      })('Confirm')
    )
  )(
    // Lifecycle: Set up ARIA attributes and ref
    (elem: HTMLDivElement) => {
      dialog.dialogProps.ref(elem);
      return () => dialog.dialogProps.ref(null);
    }
  );

  // Dialog overlay (captures clicks outside)
  const dialogOverlay = el('div', {
    className: 'dialog-overlay',
    onclick: (e: Event) => {
      if (e.target === e.currentTarget) dialog.close();
    },
  })(dialogContent);

  // Trigger button
  const triggerButton = el('button', {
    className: 'dialog-trigger',
    onclick: dialog.triggerProps.onclick,
  })('Open Dialog')(
    // Lifecycle: Set up ARIA attributes
    (elem: HTMLButtonElement) => {
      elem.setAttribute('aria-haspopup', 'dialog');
      // Update aria-expanded reactively
      return effect(() => {
        elem.setAttribute('aria-expanded', String(dialog.isOpen()));
      });
    }
  );

  return el('div', { className: 'demo-section' })(
    el('h3')('Dialog'),
    el('p', { className: 'demo-description' })(
      'Accessible modal with focus trapping, ESC to close, and focus restoration.'
    ),
    triggerButton,
    // Conditionally show dialog overlay
    el('div', {
      className: computed(() => (dialog.isOpen() ? '' : 'hidden')),
    })(dialogOverlay)
  );
}

// ============================================================================
// Select Demo
// ============================================================================

function createSelectDemo(): RefSpec<HTMLElement> {
  // Create headless select with Lattice signals
  const select = useSelect<string>({ signal, computed, effect })({
    options: selectOptions,
    placeholder: 'Choose a fruit...',
  });

  // Build option elements
  const optionElements = selectOptions.map((option, index) => {
    const props = select.getOptionProps(option, index);

    return el('li', {
      id: props.id,
      role: props.role,
      className: computed(() => {
        const classes = ['select-option'];
        if (props['aria-selected']()) classes.push('selected');
        if (select.highlightedIndex() === index) classes.push('highlighted');
        if (option.disabled) classes.push('disabled');
        return classes.join(' ');
      }),
      onclick: props.onclick,
      onmouseenter: props.onmouseenter,
      ariaDisabled: computed(() => String(!!option.disabled)),
      ariaSelected: computed(() => String(props['aria-selected']())),
    })(option.label);
  });

  // Listbox (dropdown)
  const listbox = el('ul', {
    className: computed(() =>
      select.isOpen() ? 'select-listbox' : 'select-listbox hidden'
    ),
    role: select.listboxProps.role,
  })(...optionElements)(
    // Lifecycle: Set data attribute
    (elem: HTMLUListElement) => {
      elem.dataset.selectId = select.listboxProps['data-select-id'];
    }
  );

  // Trigger button
  const trigger = el('button', {
    className: 'select-trigger',
    role: select.triggerProps.role,
    onclick: select.triggerProps.onclick,
    ariaHasPopup: 'listbox',
    onkeydown: select.triggerProps.onkeydown,
    ariaExpanded: computed(() => String(select.isOpen())),
  })(select.selectedLabel)(
    // Lifecycle: Set up ARIA attributes and keyboard handler
    (elem: HTMLButtonElement) => {
      elem.dataset.selectId = select.triggerProps['data-select-id'];

      const disposeDescendant = effect(() => {
        const active = select.triggerProps['aria-activedescendant']();
        if (active) {
          elem.setAttribute('aria-activedescendant', active);
        } else {
          elem.removeAttribute('aria-activedescendant');
        }
      });

      return () => {
        disposeDescendant();
      };
    }
  );

  return el('div', { className: 'demo-section' })(
    el('h3')('Select'),
    el('p', { className: 'demo-description' })(
      'Accessible dropdown with keyboard navigation (↑↓), typeahead, and ARIA.'
    ),
    el('div', { className: 'select-wrapper' })(trigger, listbox)
  );
}

// ============================================================================
// Main App
// ============================================================================

export function createLatticeApp(): RefSpec<HTMLElement> {
  return el('div')(createDialogDemo(), createSelectDemo());
}

export function mount(container: HTMLElement) {
  const app = createLatticeApp();
  const ref = app.create(svc);
  container.appendChild(ref.element as Node);
}

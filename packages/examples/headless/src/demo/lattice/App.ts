/**
 * Lattice Demo - useDialog and useSelect with Lattice View rendering
 *
 * Demonstrates how the same headless behaviors work with Lattice's
 * native signals and view system.
 */
import { createDOMSvc } from '@lattice/view/presets/dom';
import { useDialog } from '../../useDialog';
import { useSelect, type SelectOption } from '../../useSelect';

// ============================================================================
// Create Lattice API
// ============================================================================

const {
  el,
  signal,
  computed,
  effect,
  match,
  portal,
  mount: mountSpec,
} = createDOMSvc();

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

function DialogDemo() {
  // Create headless dialog with Lattice signals
  const dialog = useDialog({ signal, computed, effect })({});

  // Dialog content element
  const dialogContent = el('div')
    .props({
      className: 'dialog-content',
      role: dialog.dialogProps.role,
      tabIndex: -1,
      ariaModal: 'true',
      ariaLabel: 'Dialog',
      onkeydown: dialog.dialogProps.onkeydown,
    })
    .ref((elem: HTMLDivElement) => {
      // Lifecycle: Set up ARIA attributes and ref
      dialog.dialogProps.ref(elem);
      return () => dialog.dialogProps.ref(null);
    })(
    el('h4')('Headless Dialog'),
    el('p')(
      'This dialog is built with the ',
      el('code')('useDialog'),
      ' headless behavior. It handles focus trapping, keyboard navigation (ESC to close), and returns focus to the trigger on close.'
    ),
    el('div').props({ className: 'dialog-actions' })(
      el('button').props({
        className: 'dialog-close',
        onclick: dialog.closeButtonProps.onclick,
      })('Cancel'),
      el('button').props({
        className: 'dialog-confirm',
        onclick: dialog.close,
      })('Confirm')
    )
  );

  // Dialog overlay (captures clicks outside)
  const dialogOverlay = el('div').props({
    className: 'dialog-overlay',
    onclick: (e: Event) => {
      if (e.target === e.currentTarget) dialog.close();
    },
  })(dialogContent);

  // Trigger button
  const triggerButton = el('button')
    .props({
      className: 'dialog-trigger',
      onclick: dialog.triggerProps.onclick,
    })
    .ref((elem) => {
      // Lifecycle: Set up ARIA attributes
      elem.setAttribute('aria-haspopup', 'dialog');
      // Update aria-expanded reactively
      return effect(() => {
        elem.setAttribute('aria-expanded', String(dialog.isOpen()));
      });
    })('Open Dialog');

  return el('div').props({ className: 'demo-section' })(
    el('h3')('Dialog'),
    el('p').props({ className: 'demo-description' })(
      'Accessible modal with focus trapping, ESC to close, and focus restoration.'
    ),
    triggerButton,
    // Portal dialog to document.body when open
    match(
      () => dialog.isOpen(),
      (isOpen) => (isOpen ? portal()(dialogOverlay) : null)
    )
  );
}

// ============================================================================
// Select Demo
// ============================================================================

function SelectDemo() {
  // Create headless select with Lattice signals
  const select = useSelect<string>({ signal, computed, effect })({
    options: selectOptions,
    placeholder: 'Choose a fruit...',
  });

  // Build option elements
  const optionElements = selectOptions.map((option, index) => {
    const props = select.getOptionProps(option, index);

    return el('li').props({
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
  const listbox = el('ul')
    .props({
      className: computed(() =>
        select.isOpen() ? 'select-listbox' : 'select-listbox hidden'
      ),
      role: select.listboxProps.role,
    })
    .ref((elem) => {
      // Lifecycle: Set data attribute
      elem.dataset.selectId = select.listboxProps['data-select-id'];
    })(...optionElements);

  // Trigger button
  const trigger = el('button')
    .props({
      className: 'select-trigger',
      role: select.triggerProps.role,
      onclick: select.triggerProps.onclick,
      ariaHasPopup: 'listbox',
      onkeydown: select.triggerProps.onkeydown,
      ariaExpanded: computed(() => String(select.isOpen())),
      dataSelectId: select.triggerProps['data-select-id'],
    })
    .ref((elem) => {
      // Lifecycle: Set up ARIA attributes and keyboard handler
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
    })(select.selectedLabel);

  return el('div').props({ className: 'demo-section' })(
    el('h3')('Select'),
    el('p').props({ className: 'demo-description' })(
      'Accessible dropdown with keyboard navigation (↑↓), typeahead, and ARIA.'
    ),
    el('div').props({ className: 'select-wrapper' })(trigger, listbox)
  );
}

// ============================================================================
// Main App
// ============================================================================

export function App() {
  return el('div')(DialogDemo(), SelectDemo());
}

export function mount(container: HTMLElement) {
  const ref = mountSpec(App());
  container.appendChild(ref.element as Node);
}

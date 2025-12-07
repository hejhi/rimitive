/**
 * Lattice Demo - useDialog and useSelect with Lattice View rendering
 *
 * Demonstrates how the same headless behaviors work with Lattice's
 * native signals and view system.
 */
import { createDOMView } from '@lattice/view/presets/dom';
import { dialog } from '../../dialog';
import { select, type SelectOption } from '../../select';
import { createSignals } from '@lattice/signals';

const signals = createSignals();
const use = createDOMView({ signals });
const { el, computed, effect, match, portal, mount: mountSpec } = use();

// Bind behaviors to this service
const useDialog = use(dialog);
const useSelect = use(select<string>);

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
  // Create headless dialog
  const dlg = useDialog();

  // Dialog content element
  const dialogContent = el('div')
    .props({
      className: 'dialog-content',
      role: dlg.dialogProps.role,
      tabIndex: -1,
      ariaModal: 'true',
      ariaLabel: 'Dialog',
      onkeydown: dlg.dialogProps.onkeydown,
    })
    .ref((elem: HTMLDivElement) => {
      // Lifecycle: Set up ARIA attributes and ref
      dlg.dialogProps.ref(elem);
      return () => dlg.dialogProps.ref(null);
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
        onclick: dlg.closeButtonProps.onclick,
      })('Cancel'),
      el('button').props({
        className: 'dialog-confirm',
        onclick: dlg.close,
      })('Confirm')
    )
  );

  // Dialog overlay (captures clicks outside)
  const dialogOverlay = el('div').props({
    className: 'dialog-overlay',
    onclick: (e: Event) => {
      if (e.target === e.currentTarget) dlg.close();
    },
  })(dialogContent);

  // Trigger button
  const triggerButton = el('button')
    .props({
      className: 'dialog-trigger',
      onclick: dlg.triggerProps.onclick,
    })
    .ref((elem) => {
      // Lifecycle: Set up ARIA attributes
      elem.setAttribute('aria-haspopup', 'dialog');
      // Update aria-expanded reactively
      return effect(() => {
        elem.setAttribute('aria-expanded', String(dlg.isOpen()));
      });
    })('Open Dialog');

  return el('div').props({ className: 'demo-section' })(
    el('h3')('Dialog'),
    el('p').props({ className: 'demo-description' })(
      'Accessible modal with focus trapping, ESC to close, and focus restoration.'
    ),
    triggerButton,
    // Portal dialog to document.body when open
    match(dlg.isOpen, (isOpen) => (isOpen ? portal()(dialogOverlay) : null))
  );
}

// ============================================================================
// Select Demo
// ============================================================================

function SelectDemo() {
  // Create headless select
  const sel = useSelect({
    options: selectOptions,
    placeholder: 'Choose a fruit...',
  });

  // Build option elements
  const optionElements = selectOptions.map((option, index) => {
    const props = sel.getOptionProps(option, index);

    return el('li').props({
      id: props.id,
      role: props.role,
      className: computed(() => {
        const classes = ['select-option'];
        if (props['aria-selected']()) classes.push('selected');
        if (sel.highlightedIndex() === index) classes.push('highlighted');
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
        sel.isOpen() ? 'select-listbox' : 'select-listbox hidden'
      ),
      role: sel.listboxProps.role,
    })
    .ref((elem) => {
      // Lifecycle: Set data attribute
      elem.dataset.selectId = sel.listboxProps['data-select-id'];
    })(...optionElements);

  // Trigger button
  const trigger = el('button')
    .props({
      className: 'select-trigger',
      role: sel.triggerProps.role,
      onclick: sel.triggerProps.onclick,
      ariaHasPopup: 'listbox',
      onkeydown: sel.triggerProps.onkeydown,
      ariaExpanded: computed(() => String(sel.isOpen())),
      dataSelectId: sel.triggerProps['data-select-id'],
    })
    .ref((elem) => {
      // Lifecycle: Set up ARIA attributes and keyboard handler
      const disposeDescendant = effect(() => {
        const active = sel.triggerProps['aria-activedescendant']();
        if (active) {
          elem.setAttribute('aria-activedescendant', active);
        } else {
          elem.removeAttribute('aria-activedescendant');
        }
      });

      return () => {
        disposeDescendant();
      };
    })(sel.selectedLabel);

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

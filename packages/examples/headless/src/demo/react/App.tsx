/**
 * React Demo - useDialog and useSelect with React rendering
 *
 * Demonstrates how the same headless behaviors work with React
 * using @lattice/react's createHook and useSubscribe.
 */
import { SignalProvider, createHook, useSubscribe } from '@lattice/react';
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { dialog } from '../../dialog';
import { select, type SelectOption } from '../../select';

// ============================================================================
// Create Lattice Signals Service (singleton for the React tree)
// ============================================================================

const signalsSvc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule
);

// ============================================================================
// Create React hooks from portable headless behaviors
// ============================================================================

// These are created at module level - clean, declarative pattern
const useDialog = createHook(dialog);
const useSelect = createHook(select);

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
  // Clean, familiar React hook API
  const dialog = useDialog();

  // Subscribe to reactive values for React re-renders
  const isOpen = useSubscribe(dialog.isOpen);

  return (
    <div className="demo-section">
      <h3>Dialog</h3>
      <p className="demo-description">
        Accessible modal with focus trapping, ESC to close, and focus
        restoration.
      </p>
      <button
        className="dialog-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={dialog.triggerProps.onclick}
      >
        Open Dialog
      </button>

      {isOpen && (
        <div className="dialog-overlay" onClick={dialog.close}>
          <div
            ref={(el) => {
              dialog.dialogProps.ref(el);
            }}
            className="dialog-content"
            role="dialog"
            aria-modal={true}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => dialog.dialogProps.onkeydown(e.nativeEvent)}
            tabIndex={-1}
          >
            <h4>Headless Dialog</h4>
            <p>
              This dialog is built with the <code>useDialog</code> headless
              behavior. It handles focus trapping, keyboard navigation (ESC to
              close), and returns focus to the trigger on close.
            </p>
            <div className="dialog-actions">
              <button
                className="dialog-close"
                aria-label={dialog.closeButtonProps['aria-label']}
                onClick={dialog.closeButtonProps.onclick}
              >
                Cancel
              </button>
              <button className="dialog-confirm" onClick={dialog.close}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Select Demo
// ============================================================================

function SelectDemo() {
  // Clean, familiar React hook API with options
  const select = useSelect({
    options: selectOptions,
    placeholder: 'Choose a fruit...',
  });

  // Subscribe to reactive values for React re-renders
  const isOpen = useSubscribe(select.isOpen);
  const selectedLabel = useSubscribe(select.selectedLabel);
  const highlightedIndex = useSubscribe(select.highlightedIndex);

  return (
    <div className="demo-section">
      <h3>Select</h3>
      <p className="demo-description">
        Accessible dropdown with keyboard navigation (↑↓), typeahead, and ARIA.
      </p>
      <div className="select-wrapper">
        <button
          className="select-trigger"
          role={select.triggerProps.role}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={select.triggerProps.onclick}
          onKeyDown={(e) => select.triggerProps.onkeydown(e.nativeEvent)}
        >
          {selectedLabel}
        </button>

        {isOpen && (
          <ul
            className="select-listbox"
            role="listbox"
            data-select-id={select.listboxProps['data-select-id']}
          >
            {selectOptions.map((option, index) => {
              const props = select.getOptionProps(option, index);
              const isHighlighted = highlightedIndex === index;

              return (
                <li
                  key={option.value}
                  id={props.id}
                  role={props.role}
                  aria-selected={select.selectedValue() === option.value}
                  aria-disabled={option.disabled}
                  className={[
                    'select-option',
                    select.selectedValue() === option.value && 'selected',
                    isHighlighted && 'highlighted',
                    option.disabled && 'disabled',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={props.onclick}
                  onMouseEnter={props.onmouseenter}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main App (wrapped with SignalProvider)
// ============================================================================

function AppContent() {
  return (
    <div>
      <DialogDemo />
      <SelectDemo />
    </div>
  );
}

export function ReactApp() {
  return (
    <SignalProvider svc={signalsSvc}>
      <AppContent />
    </SignalProvider>
  );
}

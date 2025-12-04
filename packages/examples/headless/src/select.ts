/**
 * useSelect - Headless Select/Combobox Behavior
 *
 * A framework-agnostic, accessible select (dropdown) behavior.
 * Provides state management, ARIA attributes, keyboard navigation, and typeahead.
 *
 * WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 *
 * @example
 * ```ts
 * // With Lattice signals
 * import { useSelect } from '@lattice/headless/useSelect';
 * import { signal, computed, effect } from './my-signals';
 *
 * const select = useSelect({ signal, computed, effect })({
 *   options: [
 *     { value: 'apple', label: 'Apple' },
 *     { value: 'banana', label: 'Banana' },
 *   ],
 * });
 *
 * // Use in your UI framework:
 * // <button {...select.triggerProps}>{select.selectedLabel()}</button>
 * // <ul {...select.listboxProps}>
 * //   {options.map(opt => <li {...select.getOptionProps(opt)} />)}
 * // </ul>
 * ```
 */
import type { SignalsApi, Signal, Computed } from './types';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface UseSelectOptions<T = string> {
  /** Available options */
  options: SelectOption<T>[];
  /** Initially selected value */
  initialValue?: T;
  /** Placeholder when nothing selected */
  placeholder?: string;
  /** Called when selection changes */
  onChange?: (value: T | undefined) => void;
}

export interface SelectState<T = string> {
  /** Whether the dropdown is open */
  isOpen: Signal<boolean>;
  /** Currently selected value */
  selectedValue: Signal<T | undefined>;
  /** Label of the selected option (or placeholder) */
  selectedLabel: Computed<string>;
  /** Index of the currently highlighted option (for keyboard nav) */
  highlightedIndex: Signal<number>;

  /** Open the dropdown */
  open: () => void;
  /** Close the dropdown */
  close: () => void;
  /** Toggle the dropdown */
  toggle: () => void;
  /** Select an option by value */
  select: (value: T) => void;

  /** Props to spread on the trigger button */
  triggerProps: {
    role: 'combobox';
    'aria-haspopup': 'listbox';
    'aria-expanded': Computed<boolean>;
    'aria-activedescendant': Computed<string | undefined>;
    'data-select-id': string;
    onclick: () => void;
    onkeydown: (e: KeyboardEvent) => void;
  };

  /** Props to spread on the listbox (dropdown container) */
  listboxProps: {
    role: 'listbox';
    'aria-hidden': Computed<boolean>;
    'data-select-id': string;
  };

  /** Get props for an individual option */
  getOptionProps: (
    option: SelectOption<T>,
    index: number
  ) => {
    role: 'option';
    id: string;
    'aria-selected': Computed<boolean>;
    'aria-disabled': boolean | undefined;
    onclick: () => void;
    onmouseenter: () => void;
  };
}

// Generate unique IDs for options
let selectIdCounter = 0;

/**
 * Creates a headless select behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates select state
 */
export const select =
  <T = string>(api: SignalsApi) =>
  (options: UseSelectOptions<T>): SelectState<T> => {
    const { signal, computed, effect } = api;
    const {
      options: selectOptions,
      initialValue,
      placeholder = 'Select an option',
      onChange,
    } = options;

    // Generate unique base ID for this select instance
    const baseId = `select-${++selectIdCounter}`;

    // Core state
    const isOpen = signal(false);
    const selectedValue = signal<T | undefined>(initialValue);
    const highlightedIndex = signal(-1);

    // Typeahead state
    let typeaheadBuffer = '';
    let typeaheadTimeout: ReturnType<typeof setTimeout> | null = null;

    // Computed: selected option's label or placeholder
    const selectedLabel = computed(() => {
      const value = selectedValue();
      if (value === undefined) return placeholder;
      const option = selectOptions.find((opt) => opt.value === value);
      return option?.label ?? placeholder;
    });

    // Helper: get enabled options for navigation
    const getEnabledIndices = () =>
      selectOptions
        .map((opt, i) => ({ opt, i }))
        .filter(({ opt }) => !opt.disabled)
        .map(({ i }) => i);

    // Helper: find next/prev enabled option
    const findNextEnabled = (
      currentIndex: number,
      direction: 1 | -1
    ): number => {
      const enabled = getEnabledIndices();
      if (enabled.length === 0) return -1;

      const first = enabled[0]!;
      const last = enabled[enabled.length - 1]!;

      if (currentIndex === -1) {
        return direction === 1 ? first : last;
      }

      const currentPos = enabled.indexOf(currentIndex);
      if (currentPos === -1) {
        // Current index is disabled, find nearest
        return direction === 1 ? first : last;
      }

      const nextPos = currentPos + direction;
      if (nextPos < 0) return last;
      if (nextPos >= enabled.length) return first;
      return enabled[nextPos]!;
    };

    // Actions
    const open = () => {
      isOpen(true);
      // Highlight selected option or first enabled
      const value = selectedValue();
      if (value !== undefined) {
        const idx = selectOptions.findIndex((opt) => opt.value === value);
        highlightedIndex(idx >= 0 ? idx : findNextEnabled(-1, 1));
      } else {
        highlightedIndex(findNextEnabled(-1, 1));
      }
    };

    const close = () => {
      isOpen(false);
      highlightedIndex(-1);
      typeaheadBuffer = '';
    };

    const toggle = () => {
      if (isOpen()) {
        close();
      } else {
        open();
      }
    };

    const select = (value: T) => {
      const option = selectOptions.find((opt) => opt.value === value);
      if (option?.disabled) return;

      selectedValue(value);
      onChange?.(value);
      close();
    };

    // Typeahead: find option starting with typed characters
    const handleTypeahead = (char: string) => {
      if (typeaheadTimeout) clearTimeout(typeaheadTimeout);

      typeaheadBuffer += char.toLowerCase();

      // Reset buffer after 500ms of no typing
      typeaheadTimeout = setTimeout(() => {
        typeaheadBuffer = '';
      }, 500);

      // Find first matching option
      const matchIndex = selectOptions.findIndex(
        (opt) =>
          !opt.disabled && opt.label.toLowerCase().startsWith(typeaheadBuffer)
      );

      if (matchIndex >= 0) {
        highlightedIndex(matchIndex);
      }
    };

    // Keyboard handler
    const handleKeydown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen()) {
            const idx = highlightedIndex();
            const option = selectOptions[idx];
            if (idx >= 0 && option && !option.disabled) {
              select(option.value);
            }
          } else {
            open();
          }
          break;

        case 'Escape':
          e.preventDefault();
          close();
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen()) {
            open();
          } else {
            highlightedIndex(findNextEnabled(highlightedIndex(), 1));
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (!isOpen()) {
            open();
          } else {
            highlightedIndex(findNextEnabled(highlightedIndex(), -1));
          }
          break;

        case 'Home':
          e.preventDefault();
          if (isOpen()) {
            const enabled = getEnabledIndices();
            const first = enabled[0];
            if (first !== undefined) highlightedIndex(first);
          }
          break;

        case 'End':
          e.preventDefault();
          if (isOpen()) {
            const enabled = getEnabledIndices();
            const last = enabled[enabled.length - 1];
            if (last !== undefined) highlightedIndex(last);
          }
          break;

        default:
          // Typeahead for printable characters
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (isOpen()) {
              handleTypeahead(e.key);
            }
          }
          break;
      }
    };

    // Close on outside click (effect should be set up by consumer)
    effect(() => {
      if (!isOpen()) return;

      const handleClickOutside = (e: MouseEvent) => {
        // Consumer should handle this by checking if click is inside their component
        // This is a basic implementation that might need refinement
        const target = e.target as HTMLElement;
        if (!target.closest(`[data-select-id="${baseId}"]`)) {
          close();
        }
      };

      document.addEventListener('click', handleClickOutside, true);
      return () =>
        document.removeEventListener('click', handleClickOutside, true);
    });

    return {
      isOpen,
      selectedValue,
      selectedLabel,
      highlightedIndex,

      open,
      close,
      toggle,
      select,

      triggerProps: {
        role: 'combobox',
        'aria-haspopup': 'listbox',
        'aria-expanded': computed(() => isOpen()),
        'aria-activedescendant': computed(() => {
          const idx = highlightedIndex();
          return idx >= 0 ? `${baseId}-option-${idx}` : undefined;
        }),
        'data-select-id': baseId,
        onclick: toggle,
        onkeydown: handleKeydown,
      },

      listboxProps: {
        role: 'listbox',
        'aria-hidden': computed(() => !isOpen()),
        'data-select-id': baseId,
      },

      getOptionProps: (option: SelectOption<T>, index: number) => ({
        role: 'option',
        id: `${baseId}-option-${index}`,
        'aria-selected': computed(() => selectedValue() === option.value),
        'aria-disabled': option.disabled,
        onclick: () => {
          if (!option.disabled) select(option.value);
        },
        onmouseenter: () => {
          if (!option.disabled) highlightedIndex(index);
        },
      }),
    };
  };

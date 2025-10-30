/**
 * Conditional Element Example
 *
 * Demonstrates conditional el logic:
 * 1. Toggling element visibility (null vs element)
 * 2. Switching between different element types
 * 3. Dynamic element properties based on state
 */

import type { LatticeViewAPI } from '../types';

export function ConditionalExample(api: LatticeViewAPI) {
  const { el, signal, computed } = api;

  // State for various conditional examples
  const showMessage = signal(true);
  const isEditMode = signal(false);
  const editText = signal('Click edit to change this text');
  const buttonType = signal<'primary' | 'danger' | 'success'>('primary');

  // Toggle message visibility
  const toggleBtn = el(['button', 'Toggle Message'])((btn) => {
    return api.on(btn, 'click', () => showMessage(!showMessage()));
  });

  // Conditional message - renders null when hidden
  const conditionalMessage = el(
    computed(() => {
      if (!showMessage()) return null;
      return ['div', { className: 'conditional-message' }, '👋 This message can be toggled on and off!'] as [
        'div',
        { className: string },
        string
      ];
    })
  );

  // Toggle edit mode
  const editToggleBtn = el([
    'button',
    computed(() => (isEditMode() ? 'Save' : 'Edit')),
  ])((btn) => {
    return api.on(btn, 'click', () => isEditMode(!isEditMode()));
  });

  // Switch between input and span based on edit mode
  const editableText = el(
    computed(() => {
      if (isEditMode()) {
        return [
          'input',
          {
            type: 'text',
            value: editText,
            className: 'edit-input',
          },
        ] as ['input', { type: string; value: typeof editText; className: string }];
      } else {
        return ['span', { className: 'display-text' }, editText] as [
          'span',
          { className: string },
          typeof editText
        ];
      }
    })
  );

  // Event handler for input changes - using effect to sync input value
  api.effect(() => {
    // This effect tracks when isEditMode changes
    // When in edit mode and the element is an input, attach the event listener
    if (isEditMode()) {
      // Need to wait for next frame to ensure DOM is updated
      setTimeout(() => {
        const input = document.querySelector('.edit-input') as HTMLInputElement;
        if (input) {
          const handler = (e: Event) => {
            editText((e.target as HTMLInputElement).value);
          };
          input.addEventListener('input', handler);
        }
      }, 0);
    }
  });

  // Cycle button type
  const cycleTypeBtn = el(['button', 'Change Button Style'])((btn) => {
    return api.on(btn, 'click', () => {
      const types: Array<'primary' | 'danger' | 'success'> = ['primary', 'danger', 'success'];
      const current = buttonType();
      const currentIndex = types.indexOf(current);
      const nextIndex = (currentIndex + 1) % types.length;
      const nextType = types[nextIndex];
      if (nextType !== undefined) {
        buttonType(nextType);
      }
    });
  });

  // Dynamic button that changes based on state
  const dynamicButton = el(
    computed(() => {
      const type = buttonType();
      const labels = {
        primary: '🔵 Primary Action',
        danger: '🔴 Danger Action',
        success: '🟢 Success Action',
      };

      return ['button', { className: `dynamic-btn ${type}` }, labels[type]] as [
        'button',
        { className: string },
        string
      ];
    })
  );

  return el([
    'div',
    { className: 'example conditional-example' },
    el(['h2', 'Conditional Element Example']),
    el(['p', 'Demonstrates reactive conditional rendering with el(computed(() => spec | null)).']),

    // Example 1: Toggle visibility
    el([
      'div',
      { className: 'example-section' },
      el(['h3', 'Example 1: Toggle Visibility']),
      el(['p', 'Element can be shown/hidden by returning null from the computed spec.']),
      toggleBtn,
      conditionalMessage,
    ]),

    // Example 2: Switch element types
    el([
      'div',
      { className: 'example-section' },
      el(['h3', 'Example 2: Switch Element Types']),
      el(['p', 'Switch between <input> and <span> based on edit mode.']),
      editableText,
      editToggleBtn,
    ]),

    // Example 3: Dynamic styling
    el([
      'div',
      { className: 'example-section' },
      el(['h3', 'Example 3: Dynamic Styling']),
      el(['p', 'Element properties and styles change based on state.']),
      dynamicButton,
      cycleTypeBtn,
    ]),
  ]);
}

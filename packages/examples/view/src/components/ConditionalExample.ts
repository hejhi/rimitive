import { create } from '../api';

export const ConditionalExample = create(
  ({ el, signal, computed, on, effect }) =>
    () => {
      // State for various conditional examples
      const showMessage = signal(true);
      const isEditMode = signal(false);
      const editText = signal('Click edit to change this text');
      const buttonType = signal<'primary' | 'danger' | 'success'>('primary');

      // Toggle message visibility
      const toggleBtn = el('button')('Toggle Message')(
        on('click', () => showMessage(!showMessage()))
      );

      // Conditional message - renders null when hidden
      const conditionalMessage = el(
        computed(() => showMessage() ? 'div' : null),
        { className: 'conditional-message' }
      )(
        el('span')('👋 This message can be toggled on and off!')
      );

      // Toggle edit mode
      const editToggleBtn = el('button')(
        computed(() => (isEditMode() ? 'Save' : 'Edit'))
      )(on('click', () => isEditMode(!isEditMode())));

      // Switch between input and span based on edit mode
      const editableText = el(
        computed(() => isEditMode() ? 'input' : 'span'),
        {
          type: computed(() => isEditMode() ? 'text' : undefined),
          value: computed(() => isEditMode() ? editText() : undefined),
          className: computed(() => isEditMode() ? 'edit-input' : 'display-text'),
        }
      )(
        computed(() => isEditMode() ? '' : editText())
      );

      // Event handler for input changes - using effect to sync input value
      effect(() => {
        // This effect tracks when isEditMode changes
        // When in edit mode and the element is an input, attach the event listener
        if (isEditMode()) {
          // Need to wait for next frame to ensure DOM is updated
          setTimeout(() => {
            const input = document.querySelector(
              '.edit-input'
            ) as HTMLInputElement;
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
      const cycleTypeBtn = el('button')('Change Button Style')(
        on('click', () => {
          const types: Array<'primary' | 'danger' | 'success'> = [
            'primary',
            'danger',
            'success',
          ];
          const current = buttonType();
          const currentIndex = types.indexOf(current);
          const nextIndex = (currentIndex + 1) % types.length;
          const nextType = types[nextIndex];
          if (nextType !== undefined) {
            buttonType(nextType);
          }
        })
      );

      // Dynamic button that changes based on state
      const dynamicButton = el(
        computed(() => 'button' as const),
        { className: computed(() => `dynamic-btn ${buttonType()}`) }
      )(
        computed(() => {
          const type = buttonType();
          const labels = {
            primary: '🔵 Primary Action',
            danger: '🔴 Danger Action',
            success: '🟢 Success Action',
          };
          return labels[type];
        })
      );

      return el('div', { className: 'example conditional-example' })(
        el('h2')('Conditional Element Example'),
        el('p')(
          'Demonstrates reactive conditional rendering with el(computed(() => spec | null)).'
        ),

        // Example 1: Toggle visibility
        el('div', { className: 'example-section' })(
          el('h3')('Example 1: Toggle Visibility'),
          el('p')(
            'Element can be shown/hidden by returning null from the computed spec.'
          ),
          toggleBtn,
          conditionalMessage
        ),

        // Example 2: Switch element types
        el('div', { className: 'example-section' })(
          el('h3')('Example 2: Switch Element Types'),
          el('p')('Switch between <input> and <span> based on edit mode.'),
          editableText,
          editToggleBtn
        ),

        // Example 3: Dynamic styling
        el('div', { className: 'example-section' })(
          el('h3')('Example 3: Dynamic Styling'),
          el('p')('Element properties and styles change based on state.'),
          dynamicButton,
          cycleTypeBtn
        )
      );
    }
);

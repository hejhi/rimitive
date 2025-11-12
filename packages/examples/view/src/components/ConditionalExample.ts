import { create } from '../api';

export const ConditionalExample = create(
  ({ el, signal, computed, on }) =>
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

      // Pattern 1: Reactive tags with only common props
      // Since input and span don't share type/value props, we only use className
      const editableText = el(
        computed(() => isEditMode() ? 'input' : 'span'),
        {
          // Only common properties work here (className exists on both)
          className: computed(() => isEditMode() ? 'edit-input' : 'display-text'),
        }
      )(
        computed(() => isEditMode() ? '' : editText())
      )(
        // Use lifecycle callback to handle element-specific behavior
        (el) => {
          if (el instanceof HTMLInputElement) {
            // Set input-specific attributes
            el.type = 'text';
            el.value = editText();

            // Handle input changes
            const handler = (e: Event) => {
              editText((e.target as HTMLInputElement).value);
            };
            el.addEventListener('input', handler);

            return () => el.removeEventListener('input', handler);
          }
          return undefined;
        }
      );

      // Pattern 2: Alternative - use separate conditional elements
      // When elements need different props, conditionally render separate specs
      const editableTextAlt = el('div', { className: 'editable-wrapper' })(
        // Input (only renders in edit mode) with all its specific props
        el(
          computed(() => isEditMode() ? 'input' : null),
          { type: 'text', className: 'edit-input' }
        )()(
          (input) => {
            // Sync input value with signal
            input.value = editText();
            const handler = (e: Event) => {
              editText((e.target as HTMLInputElement).value);
            };
            input.addEventListener('input', handler);
            return () => input.removeEventListener('input', handler);
          }
        ),
        // Span (only renders in display mode)
        el(
          computed(() => !isEditMode() ? 'span' : null),
          { className: 'display-text' }
        )(editText)
      );

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
          el('p')('Two patterns for handling elements with different props:'),
          el('p')('Pattern 1: Reactive tag with common props, element-specific in lifecycle'),
          editableText,
          el('br')(),
          el('p')('Pattern 2: Separate conditional elements, each with their own props'),
          editableTextAlt,
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

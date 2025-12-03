import { el, signal, computed, match } from '../service';

export const ConditionalExample = () => {
  // State for various conditional examples
  const showMessage = signal(true);
  const isEditMode = signal(false);
  const editText = signal('Click edit to change this text');
  const buttonType = signal<'primary' | 'danger' | 'success'>('primary');

  // Toggle message visibility
  const toggleBtn = el('button').props({
    onclick: () => showMessage(!showMessage()),
  })('Toggle Message');

  // Conditional message - renders null when hidden
  const conditionalMessage = match(showMessage, (show: boolean) =>
    show
      ? el('div').props({ className: 'conditional-message' })(
          el('span')('👋 This message can be toggled on and off!')
        )
      : null
  );

  // Toggle edit mode
  const editToggleBtn = el('button').props({
    onclick: () => isEditMode(!isEditMode()),
  })(computed(() => (isEditMode() ? 'Save' : 'Edit')));

  // Pattern 1: Match with conditional element types
  // Use match to switch between input and span based on edit mode
  const editableText = match(isEditMode, (isEdit: boolean) =>
    isEdit
      ? el('input')
          .props({
            type: 'text',
            className: 'edit-input',
            value: editText,
          })
          .ref((input) => {
            const handler = (e: Event) => {
              editText((e.target as HTMLInputElement).value);
            };
            input.addEventListener('input', handler);
            return () => input.removeEventListener('input', handler);
          })()
      : el('span').props({ className: 'display-text' })(editText)
  );

  // Pattern 2: Alternative - use separate conditional elements with match
  // Multiple conditional elements can be composed
  const editableTextAlt = el('div').props({ className: 'editable-wrapper' })(
    // Input (only renders in edit mode) with all its specific props
    match(isEditMode, (isEdit: boolean) =>
      isEdit
        ? el('input')
            .props({
              type: 'text',
              className: 'edit-input',
              value: editText,
            })
            .ref((input) => {
              const handler = (e: Event) => {
                editText((e.target as HTMLInputElement).value);
              };
              input.addEventListener('input', handler);
              return () => input.removeEventListener('input', handler);
            })()
        : null
    ),
    // Span (only renders in display mode)
    match(isEditMode, (isEdit: boolean) =>
      !isEdit ? el('span').props({ className: 'display-text' })(editText) : null
    )
  );

  // Cycle button type
  const cycleTypeBtn = el('button').props({
    onclick: () => {
      const types: Array<'primary' | 'danger' | 'success'> = [
        'primary',
        'danger',
        'success',
      ];
      const currentIndex = types.indexOf(buttonType());
      const nextIndex = (currentIndex + 1) % types.length;
      const nextType = types[nextIndex];

      if (nextType === undefined) return;
      buttonType(nextType);
    },
  })('Change Button Style');

  // Dynamic button that changes based on state
  // Static button element with reactive props and children
  const dynamicButton = el('button').props({
    className: computed(() => `dynamic-btn ${buttonType()}`),
  })(
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

  return el('div').props({ className: 'example conditional-example' })(
    el('h2')('Conditional Element Example'),
    el('p')(
      'Demonstrates reactive conditional rendering with match(reactive, (value) => refSpec | null).'
    ),

    // Example 1: Toggle visibility
    el('div').props({ className: 'example-section' })(
      el('h3')('Example 1: Toggle Visibility'),
      el('p')(
        'Element can be shown/hidden by returning null from the computed spec.'
      ),
      toggleBtn,
      conditionalMessage
    ),

    // Example 2: Switch element types
    el('div').props({ className: 'example-section' })(
      el('h3')('Example 2: Switch Element Types'),
      el('p')('Two patterns for handling elements with different props:'),
      el('p')(
        'Pattern 1: Match switches between different element types with their own props'
      ),
      editableText,
      el('br')(),
      el('p')(
        'Pattern 2: Separate conditional elements using match for show/hide behavior'
      ),
      editableTextAlt,
      editToggleBtn
    ),

    // Example 3: Dynamic styling
    el('div').props({ className: 'example-section' })(
      el('h3')('Example 3: Dynamic Styling'),
      el('p')('Element properties and styles change based on state.'),
      dynamicButton,
      cycleTypeBtn
    )
  );
};

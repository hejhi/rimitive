import { describe, it, expect } from 'vitest';
import { createLatticeContext } from './context';

describe('Context Lifecycle Example', () => {
  it('should demonstrate component-like lifecycle with automatic cleanup', () => {
    // Simulate a parent component
    const appContext = createLatticeContext();

    // App-level state
    const theme = appContext.signal('light');
    const user = appContext.signal({ name: 'John', age: 30 });

    let appEffectRuns = 0;
    appContext.effect(() => {
      // App-level effect monitoring theme changes
      void theme.value;
      appEffectRuns++;
    });

    // Simulate mounting a child component
    const modalContext = createLatticeContext();

    // Modal-specific state
    const isOpen = modalContext.signal(true);
    const formData = modalContext.signal({ title: '', content: '' });

    let modalEffectRuns = 0;
    let formValidations = 0;

    // Modal effects
    modalContext.effect(() => {
      void isOpen.value;
      modalEffectRuns++;
    });

    const isValid = modalContext.computed(() => {
      formValidations++;
      const data = formData.value;
      return data.title.length > 0 && data.content.length > 0;
    });

    // Initial state
    expect(appEffectRuns).toBe(1);
    expect(modalEffectRuns).toBe(1);
    expect(isValid.value).toBe(false);
    expect(formValidations).toBe(1);

    // Update modal state
    formData.value = { title: 'Test', content: 'Content' };
    expect(isValid.value).toBe(true);
    expect(formValidations).toBe(2);

    // Update app state - modal still works
    theme.value = 'dark';
    expect(appEffectRuns).toBe(2);
    expect(modalEffectRuns).toBe(1); // Unaffected

    // "Unmount" the modal by disposing its context
    modalContext.dispose();

    // Modal updates no longer trigger effects
    isOpen.value = false;
    formData.value = { title: 'New', content: 'New' };
    expect(modalEffectRuns).toBe(1); // No change
    expect(formValidations).toBe(2); // No change

    // App continues to work normally
    theme.value = 'light';
    expect(appEffectRuns).toBe(3);

    // Clean up app
    appContext.dispose();

    // No more updates
    theme.value = 'dark';
    user.value = { name: 'Jane', age: 25 };
    expect(appEffectRuns).toBe(3); // No change
  });

  it('should handle complex nested component hierarchies', () => {
    // Root app context
    const app = createLatticeContext();
    const appState = app.signal({ route: '/home' });

    // Page context
    const page = createLatticeContext();

    // Multiple widget contexts
    const widget1 = createLatticeContext();
    const widget2 = createLatticeContext();

    const widget1State = widget1.signal(0);
    const widget2State = widget2.signal(0);

    let widget1Updates = 0;
    let widget2Updates = 0;

    widget1.effect(() => {
      void widget1State.value;
      widget1Updates++;
    });

    widget2.effect(() => {
      void widget2State.value;
      widget2Updates++;
    });

    expect(widget1Updates).toBe(1);
    expect(widget2Updates).toBe(1);

    // Navigate away - each context needs to be disposed
    appState.value = { route: '/about' };
    
    // In a real app, React would dispose these via useEffect cleanup
    widget1.dispose();
    widget2.dispose();
    page.dispose();
    
    // After disposal, no more updates
    widget1State.value = 100;
    widget2State.value = 200;
    
    expect(widget1Updates).toBe(1); // No updates after disposal
    expect(widget2Updates).toBe(1); // No updates after disposal
  });
});

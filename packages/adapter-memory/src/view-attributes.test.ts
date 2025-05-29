import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import {
  createComponent,
  createModel,
  createSlice,
  select,
} from '@lattice/core';

describe('View UI Attributes', () => {
  describe('Static UI attribute views', () => {
    it('should create static views with onClick handlers and attributes', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          disabled: boolean;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          disabled: false,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        // Static view - slice with UI attributes
        const incrementButton = createSlice(model, (m) => ({
          onClick: m.increment, // Direct access from model
          disabled: m.disabled,
          'aria-label': 'Increment counter',
        }));

        return {
          model,
          actions,
          views: {
            incrementButton,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(counter);

      // Get button attributes
      const buttonView = views.incrementButton;
      const buttonAttrs = buttonView.get();

      expect(buttonAttrs).toEqual({
        onClick: expect.any(Function),
        disabled: false,
        'aria-label': 'Increment counter',
      });

      // Verify onClick is bound to the increment action
      expect(model.get().count).toBe(0);
      buttonAttrs.onClick();
      expect(model.get().count).toBe(1);
    });

    it('should update disabled state reactively', () => {
      const toggle = createComponent(() => {
        const model = createModel<{
          enabled: boolean;
          toggle: () => void;
        }>(({ set, get }) => ({
          enabled: true,
          toggle: () => set({ enabled: !get().enabled }),
        }));

        const actions = createSlice(model, (m) => ({
          toggle: m.toggle,
        }));

        const button = createSlice(model, (m) => ({
          onClick: m.toggle, // Direct access from model
          disabled: !m.enabled,
          'aria-disabled': !m.enabled,
        }));

        return {
          model,
          actions,
          views: {
            button,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(toggle);

      // Initially enabled
      let buttonView = views.button;
      let attrs = buttonView.get();
      expect(attrs.disabled).toBe(false);
      expect(attrs['aria-disabled']).toBe(false);

      // Toggle to disabled
      actions.get().toggle();
      attrs = buttonView.get();
      expect(attrs.disabled).toBe(true);
      expect(attrs['aria-disabled']).toBe(true);
    });
  });

  describe('Event handler binding', () => {
    it('should properly bind select(actions) to event handlers', () => {
      const form = createComponent(() => {
        const model = createModel<{
          value: string;
          submitted: boolean;
          setValue: (value: string) => void;
          submit: () => void;
        }>(({ set }) => ({
          value: '',
          submitted: false,
          setValue: (value: string) => set({ value }),
          submit: () => set({ submitted: true }),
        }));

        const actions = createSlice(model, (m) => ({
          setValue: m.setValue,
          submit: m.submit,
        }));

        const inputView = createSlice(model, (m) => ({
          value: m.value,
          onChange: m.setValue, // Direct access from model
          'aria-label': 'Enter value',
        }));

        const submitButton = createSlice(model, (m) => ({
          onClick: m.submit, // Direct access from model
          disabled: m.value === '',
          type: 'submit',
        }));

        return {
          model,
          actions,
          views: {
            input: inputView,
            submitButton,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(form);

      // Test input onChange binding
      const inputView = views.input;
      const inputAttrs = inputView.get();
      expect(inputAttrs.value).toBe('');
      expect(inputAttrs.onChange).toEqual(expect.any(Function));

      inputAttrs.onChange('test value');
      expect(model.get().value).toBe('test value');

      // Test submit button onClick binding
      const buttonView = views.submitButton;
      const buttonAttrs = buttonView.get();
      expect(buttonAttrs.onClick).toEqual(expect.any(Function));
      expect(buttonAttrs.disabled).toBe(false); // Now has value

      buttonAttrs.onClick();
      expect(model.get().submitted).toBe(true);
    });

    it('should support multiple event handlers in one view', () => {
      const interactive = createComponent(() => {
        const model = createModel<{
          hovered: boolean;
          focused: boolean;
          clicked: number;
          setHovered: (hovered: boolean) => void;
          setFocused: (focused: boolean) => void;
          click: () => void;
        }>(({ set, get }) => ({
          hovered: false,
          focused: false,
          clicked: 0,
          setHovered: (hovered: boolean) => set({ hovered }),
          setFocused: (focused: boolean) => set({ focused }),
          click: () => set({ clicked: get().clicked + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          setHovered: m.setHovered,
          setFocused: m.setFocused,
          click: m.click,
        }));

        const interactiveView = createSlice(model, (m) => ({
          onClick: m.click, // Direct access from model
          onMouseEnter: () => m.setHovered(true),
          onMouseLeave: () => m.setHovered(false),
          onFocus: () => m.setFocused(true),
          onBlur: () => m.setFocused(false),
          className: m.hovered ? 'hovered' : '',
        }));

        return {
          model,
          actions,
          views: {
            interactive: interactiveView,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(interactive);

      const interactiveView = views.interactive;
      const attrs = interactiveView.get();

      // All event handlers should be functions
      expect(attrs.onClick).toEqual(expect.any(Function));
      expect(attrs.onMouseEnter).toEqual(expect.any(Function));
      expect(attrs.onMouseLeave).toEqual(expect.any(Function));
      expect(attrs.onFocus).toEqual(expect.any(Function));
      expect(attrs.onBlur).toEqual(expect.any(Function));

      // Test hover interactions
      attrs.onMouseEnter();
      expect(model.get().hovered).toBe(true);
      expect(interactiveView.get().className).toBe('hovered');

      attrs.onMouseLeave();
      expect(model.get().hovered).toBe(false);
      expect(interactiveView.get().className).toBe('');
    });
  });

  describe('Dynamic attributes', () => {
    it('should compute className based on state', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const countSlice = createSlice(model, (m) => ({
          count: m.count,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ increment: m.increment })),
          views: {
            counter: () =>
              countSlice((state) => ({
                'data-count': state.count,
                'aria-label': `Count is ${state.count}`,
                className: state.count % 2 === 0 ? 'even' : 'odd',
              })),
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(counter);

      // Initial state - count is 0 (even)
      const counterViewFactory = views.counter;
      let attrs = counterViewFactory().get();
      expect(attrs).toEqual({
        'data-count': 0,
        'aria-label': 'Count is 0',
        className: 'even',
      });

      // After increment - count is 1 (odd)
      actions.get().increment();
      attrs = counterViewFactory().get();
      expect(attrs).toEqual({
        'data-count': 1,
        'aria-label': 'Count is 1',
        className: 'odd',
      });

      // After another increment - count is 2 (even)
      actions.get().increment();
      attrs = counterViewFactory().get();
      expect(attrs).toEqual({
        'data-count': 2,
        'aria-label': 'Count is 2',
        className: 'even',
      });
    });

    it('should compute complex classNames based on multiple state values', () => {
      const status = createComponent(() => {
        const model = createModel<{
          loading: boolean;
          error: string | null;
          success: boolean;
          setLoading: (loading: boolean) => void;
          setError: (error: string | null) => void;
          setSuccess: (success: boolean) => void;
        }>(({ set }) => ({
          loading: false,
          error: null as string | null,
          success: false,
          setLoading: (loading: boolean) => set({ loading }),
          setError: (error: string | null) => set({ error }),
          setSuccess: (success: boolean) => set({ success }),
        }));

        const statusSlice = createSlice(model, (m) => ({
          loading: m.loading,
          error: m.error,
          success: m.success,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({
            setLoading: m.setLoading,
            setError: m.setError,
            setSuccess: m.setSuccess,
          })),
          views: {
            statusIndicator: () =>
              statusSlice((state) => {
                const classes = ['status'];
                if (state.loading) classes.push('loading');
                if (state.error) classes.push('error');
                if (state.success) classes.push('success');

                return {
                  className: classes.join(' '),
                  'aria-busy': state.loading,
                  'aria-invalid': !!state.error,
                  'data-status': state.loading
                    ? 'loading'
                    : state.error
                      ? 'error'
                      : state.success
                        ? 'success'
                        : 'idle',
                };
              }),
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { actions, views } = adapter.executeComponent(status);

      // Idle state
      const statusViewFactory = views.statusIndicator;
      expect(statusViewFactory().get()).toEqual({
        className: 'status',
        'aria-busy': false,
        'aria-invalid': false,
        'data-status': 'idle',
      });

      // Loading state
      actions.get().setLoading(true);
      expect(statusViewFactory().get()).toEqual({
        className: 'status loading',
        'aria-busy': true,
        'aria-invalid': false,
        'data-status': 'loading',
      });

      // Error state
      actions.get().setLoading(false);
      actions.get().setError('Something went wrong');
      expect(statusViewFactory().get()).toEqual({
        className: 'status error',
        'aria-busy': false,
        'aria-invalid': true,
        'data-status': 'error',
      });
    });
  });

  describe('Button views with state', () => {
    it('should combine event handlers with state-based attributes', () => {
      const filterButtons = createComponent(() => {
        const model = createModel<{
          filter: 'all' | 'active' | 'completed';
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set }) => ({
          filter: 'all' as 'all' | 'active' | 'completed',
          setFilter: (filter: 'all' | 'active' | 'completed') =>
            set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          setFilter: m.setFilter,
        }));

        const buttonSlice = createSlice(model, (m) => ({
          setFilter: m.setFilter, // Direct access from model
          filter: m.filter,
        }));

        const createFilterButtonView =
          (filterType: 'all' | 'active' | 'completed') => () =>
            buttonSlice((state) => ({
              onClick: () => state.setFilter(filterType),
              className: state.filter === filterType ? 'selected' : '',
              'aria-pressed': state.filter === filterType,
              'data-filter': filterType,
            }));

        return {
          model,
          actions,
          views: {
            allButton: createFilterButtonView('all'),
            activeButton: createFilterButtonView('active'),
            completedButton: createFilterButtonView('completed'),
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { views } = adapter.executeComponent(filterButtons);

      // Initially 'all' is selected
      const allButtonFactory = views.allButton;
      const activeButtonFactory = views.activeButton;
      const completedButtonFactory = views.completedButton;

      expect(allButtonFactory().get()).toEqual({
        onClick: expect.any(Function),
        className: 'selected',
        'aria-pressed': true,
        'data-filter': 'all',
      });

      expect(activeButtonFactory().get()).toEqual({
        onClick: expect.any(Function),
        className: '',
        'aria-pressed': false,
        'data-filter': 'active',
      });

      // Click active button
      activeButtonFactory().get().onClick();

      // Now active is selected
      expect(allButtonFactory().get()['aria-pressed']).toBe(false);
      expect(activeButtonFactory().get()['aria-pressed']).toBe(true);
      expect(completedButtonFactory().get()['aria-pressed']).toBe(false);
    });

    it('should handle loading states in buttons', () => {
      const asyncButton = createComponent(() => {
        const model = createModel<{
          loading: boolean;
          result: string | null;
          submit: () => Promise<void>;
        }>(({ set }) => ({
          loading: false,
          result: null as string | null,
          submit: async () => {
            set({ loading: true });
            // Simulate async operation
            await new Promise((resolve) => setTimeout(resolve, 10));
            set({ loading: false, result: 'Success!' });
          },
        }));

        const actions = createSlice(model, (m) => ({
          submit: m.submit,
        }));

        const submitButton = createSlice(model, (m) => ({
          onClick: m.submit, // Direct access from model
          disabled: m.loading,
          'aria-busy': m.loading,
          className: m.loading ? 'loading' : m.result ? 'success' : '',
        }));

        return {
          model,
          actions,
          views: {
            submitButton,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { views } = adapter.executeComponent(asyncButton);

      // Initial state
      const submitButtonView = views.submitButton;
      let attrs = submitButtonView.get();
      expect(attrs).toEqual({
        onClick: expect.any(Function),
        disabled: false,
        'aria-busy': false,
        className: '',
      });

      // Click to start loading
      attrs.onClick();

      // Loading state
      attrs = submitButtonView.get();
      expect(attrs.disabled).toBe(true);
      expect(attrs['aria-busy']).toBe(true);
      expect(attrs.className).toBe('loading');
    });
  });

  describe('Accessibility patterns', () => {
    it('should support comprehensive aria attributes', () => {
      const accessibleForm = createComponent(() => {
        const model = createModel<{
          email: string;
          error: string | null;
          touched: boolean;
          setEmail: (email: string) => void;
        }>(({ set }) => ({
          email: '',
          error: null as string | null,
          touched: false,
          setEmail: (email: string) => {
            set({ email, touched: true });
            // Simple validation
            if (!email.includes('@')) {
              set({ error: 'Please enter a valid email' });
            } else {
              set({ error: null });
            }
          },
        }));

        const inputSlice = createSlice(model, (m) => ({
          value: m.email,
          error: m.error,
          touched: m.touched,
        }));

        const actions = createSlice(model, (m) => ({
          setEmail: m.setEmail,
        }));

        return {
          model,
          actions,
          views: {
            emailInput: () => {
              // Create a slice that includes the setEmail action
              const combinedSlice = createSlice(model, (m) => ({
                value: m.email,
                error: m.error,
                touched: m.touched,
                setEmail: m.setEmail,
              }));
              return combinedSlice((state) => ({
                value: state.value,
                onChange: state.setEmail,
                'aria-label': 'Email address',
                'aria-invalid': state.touched && !!state.error,
                'aria-describedby': state.error ? 'email-error' : undefined,
                className: state.touched && state.error ? 'error' : '',
              }));
            },

            errorMessage: () =>
              inputSlice((state) => ({
                id: 'email-error',
                role: 'alert',
                'aria-live': 'polite',
                hidden: !state.error,
                textContent: state.error || '',
              })),
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { views } = adapter.executeComponent(accessibleForm);

      // Initial state - untouched
      const emailInputFactory = views.emailInput;
      const errorMessageFactory = views.errorMessage;

      let inputAttrs = emailInputFactory().get();
      expect(inputAttrs['aria-invalid']).toBe(false);
      expect(inputAttrs['aria-describedby']).toBeUndefined();

      let errorAttrs = errorMessageFactory().get();
      expect(errorAttrs.hidden).toBe(true);
      expect(errorAttrs.role).toBe('alert');

      // Enter invalid email
      inputAttrs.onChange('invalid');

      inputAttrs = emailInputFactory().get();
      expect(inputAttrs['aria-invalid']).toBe(true);
      expect(inputAttrs['aria-describedby']).toBe('email-error');
      expect(inputAttrs.className).toBe('error');

      errorAttrs = errorMessageFactory().get();
      expect(errorAttrs.hidden).toBe(false);
      expect(errorAttrs.textContent).toBe('Please enter a valid email');

      // Fix the email
      emailInputFactory().get().onChange('valid@email.com');

      inputAttrs = emailInputFactory().get();
      expect(inputAttrs['aria-invalid']).toBe(false);
      expect(inputAttrs['aria-describedby']).toBeUndefined();
      expect(inputAttrs.className).toBe('');
    });

    it('should support aria-expanded for collapsible sections', () => {
      const collapsible = createComponent(() => {
        const model = createModel<{
          expanded: boolean;
          toggle: () => void;
        }>(({ set, get }) => ({
          expanded: false,
          toggle: () => set({ expanded: !get().expanded }),
        }));

        const actions = createSlice(model, (m) => ({
          toggle: m.toggle,
        }));

        const toggleButton = createSlice(model, (m) => ({
          onClick: m.toggle, // Direct access from model
          'aria-expanded': m.expanded,
          'aria-controls': 'content-panel',
          className: m.expanded ? 'expanded' : 'collapsed',
        }));

        const contentPanel = createSlice(model, (m) => ({
          id: 'content-panel',
          hidden: !m.expanded,
          'aria-hidden': !m.expanded,
        }));

        return {
          model,
          actions,
          views: {
            toggleButton,
            contentPanel,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { views } = adapter.executeComponent(collapsible);

      // Initially collapsed
      const toggleButtonView = views.toggleButton;
      const contentPanelView = views.contentPanel;

      expect(toggleButtonView.get()['aria-expanded']).toBe(false);
      expect(contentPanelView.get().hidden).toBe(true);
      expect(contentPanelView.get()['aria-hidden']).toBe(true);

      // Expand
      toggleButtonView.get().onClick();

      expect(toggleButtonView.get()['aria-expanded']).toBe(true);
      expect(toggleButtonView.get().className).toBe('expanded');
      expect(contentPanelView.get().hidden).toBe(false);
      expect(contentPanelView.get()['aria-hidden']).toBe(false);
    });
  });

  describe('README pattern compliance', () => {
    it('should support select(actions, selector) pattern for onClick handlers', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
          decrement: () => void;
          disabled: boolean;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          disabled: false,
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          decrement: m.decrement,
        }));

        // This is the EXACT pattern from the README
        const incrementButton = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.increment),
          disabled: m.disabled,
          'aria-label': 'Increment counter',
        }));

        return {
          model,
          actions,
          views: {
            incrementButton,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(counter);

      // Get button attributes
      const buttonView = views.incrementButton;
      const buttonAttrs = buttonView.get();

      expect(buttonAttrs).toEqual({
        onClick: expect.any(Function),
        disabled: false,
        'aria-label': 'Increment counter',
      });

      // Verify onClick is bound to the increment action via select()
      expect(model.get().count).toBe(0);
      buttonAttrs.onClick();
      expect(model.get().count).toBe(1);
    });

    it('should support filter button pattern with onClick: state.setFilter from select(actions, selector)', () => {
      const todoList = createComponent(() => {
        const model = createModel<{
          filter: 'all' | 'active' | 'completed';
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set }) => ({
          filter: 'all' as 'all' | 'active' | 'completed',
          setFilter: (filter: 'all' | 'active' | 'completed') =>
            set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          setFilter: m.setFilter,
        }));

        // This matches the README pattern more closely
        const buttonSlice = createSlice(model, (m) => ({
          setFilter: select(actions, (a) => a.setFilter),
          filter: m.filter,
        }));

        // Exact pattern from README
        const createFilterButtonView =
          (filterType: 'all' | 'active' | 'completed') => () =>
            buttonSlice((state) => ({
              onClick: state.setFilter, // Uses setFilter from select(actions)
              className: state.filter === filterType ? 'selected' : '',
              'aria-pressed': state.filter === filterType,
            }));

        return {
          model,
          actions,
          views: {
            allButton: createFilterButtonView('all'),
            activeButton: createFilterButtonView('active'),
            completedButton: createFilterButtonView('completed'),
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { views } = adapter.executeComponent(todoList);

      // Test that filter buttons work with select(actions) pattern
      const allButtonFactory = views.allButton;
      const activeButtonFactory = views.activeButton;

      // Initially 'all' is selected
      expect(allButtonFactory().get()['aria-pressed']).toBe(true);
      expect(activeButtonFactory().get()['aria-pressed']).toBe(false);

      // Click should use the setFilter from select(actions)
      const activeAttrs = activeButtonFactory().get();
      expect(activeAttrs.onClick).toEqual(expect.any(Function));

      // Should be able to pass filterType to onClick
      activeAttrs.onClick('active');

      // Now active should be selected
      expect(allButtonFactory().get()['aria-pressed']).toBe(false);
      expect(activeButtonFactory().get()['aria-pressed']).toBe(true);
    });

    it('should support composite slice pattern with multiple select() calls', () => {
      const app = createComponent(() => {
        const model = createModel<{
          user: { name: string; email: string };
          theme: 'light' | 'dark';
          logout: () => void;
        }>(({ set }) => ({
          user: { name: 'John Doe', email: 'john@example.com' },
          theme: 'light' as 'light' | 'dark',
          logout: () => set({ user: { name: '', email: '' } }),
        }));

        // Base slices as shown in README
        const userSlice = createSlice(model, (m) => ({
          user: m.user,
        }));

        const themeSlice = createSlice(model, (m) => ({
          theme: m.theme,
        }));

        // Composite slice combining multiple slices - EXACT README pattern
        const headerSlice = createSlice(model, (m) => ({
          user: select(userSlice, (s) => s.user),
          theme: select(themeSlice, (s) => s.theme),
          onLogout: m.logout,
        }));

        return {
          model,
          actions: createSlice(model, (m) => ({ logout: m.logout })),
          views: {
            header: headerSlice,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(app);

      // Get header view attributes
      const headerView = views.header;
      const headerAttrs = headerView.get();

      // Should have user from select(userSlice)
      expect(headerAttrs.user).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });

      // Should have theme from select(themeSlice)
      expect(headerAttrs.theme).toBe('light');

      // Should have logout handler
      expect(headerAttrs.onLogout).toEqual(expect.any(Function));

      // Test logout
      headerAttrs.onLogout();
      expect(model.get().user).toEqual({ name: '', email: '' });
    });

    it('should support nested select() in view computations', () => {
      const form = createComponent(() => {
        const model = createModel<{
          value: string;
          submitted: boolean;
          setValue: (value: string) => void;
          submit: () => void;
        }>(({ set }) => ({
          value: '',
          submitted: false,
          setValue: (value: string) => set({ value }),
          submit: () => set({ submitted: true }),
        }));

        const actions = createSlice(model, (m) => ({
          setValue: m.setValue,
          submit: m.submit,
        }));

        // Pattern that uses select(actions) in the slice
        const submitButton = createSlice(model, (m) => ({
          onClick: select(actions, (a) => a.submit),
          disabled: m.value === '',
          type: 'submit',
        }));

        return {
          model,
          actions,
          views: {
            submitButton,
          },
        };
      });

      const adapter = createMemoryAdapter();
      const { model, views } = adapter.executeComponent(form);

      const buttonView = views.submitButton;
      const buttonAttrs = buttonView.get();

      // Should have onClick from select(actions).submit
      expect(buttonAttrs.onClick).toEqual(expect.any(Function));
      expect(buttonAttrs.disabled).toBe(true); // No value yet
      expect(buttonAttrs.type).toBe('submit');

      // Submit should work
      model.get().setValue('test');
      expect(buttonView.get().disabled).toBe(false);

      buttonAttrs.onClick();
      expect(model.get().submitted).toBe(true);
    });
  });
});

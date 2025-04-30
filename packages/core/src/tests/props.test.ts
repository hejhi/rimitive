import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { PropsStore, ReactiveApi, PropsParams } from '../types';
import { createProps, mergeProps } from '../props';

describe('Props System', () => {
  describe('createProps', () => {
    it('should create a props function that returns ready-to-spread attributes', () => {
      // Setup a simple reactive API for dependency
      const dummyStore = create(() => ({
        isActive: false,
        label: 'Button',
      }));

      const dummyApi: ReactiveApi = {
        use: {},
        getState: dummyStore.getState,
        setState: dummyStore.setState,
        subscribe: dummyStore.subscribe,
      };

      // Create props for a button with the API as a dependency
      const buttonProps: PropsStore = createProps(
        'button',
        { dummyApi },
        (
          get: () => { isActive: boolean; label: string },
          params: PropsParams
        ) => ({
          role: 'button',
          'aria-pressed': get().isActive,
          'data-test-id': `button-${params.id}`,
          onClick: () => {
            /* dummy click handler */
          },
        })
      );

      // The props function should return a Zustand store
      expect(buttonProps).toBeDefined();
      expect(typeof buttonProps.getState).toBe('function');

      // When called with params, it should return DOM attributes
      const props = buttonProps.getState()({ id: 'test' });

      // Should have correct DOM/ARIA attributes
      expect(props.role).toBe('button');
      expect(props['aria-pressed']).toBe(false);
      expect(props['data-test-id']).toBe('button-test');
      expect(typeof props.onClick).toBe('function');
    });

    it('should update props reactively when underlying API state changes', () => {
      // Setup a reactive API for dependency
      const toggleStore = create(() => ({
        isPressed: false,
      }));

      const toggleApi: ReactiveApi = {
        use: {},
        getState: toggleStore.getState,
        setState: toggleStore.setState,
        subscribe: toggleStore.subscribe,
      };

      // Create props that depend on the API state
      const toggleProps = createProps(
        'toggle',
        { toggleApi },
        (get: () => { isPressed: boolean }) => ({
          role: 'button',
          'aria-pressed': get().isPressed,
          tabIndex: 0,
        })
      );

      // Initial props should reflect initial state
      let props = toggleProps.getState()({});
      expect(props['aria-pressed']).toBe(false);

      // Update the underlying state
      toggleStore.setState({ isPressed: true });

      // Props should reflect the updated state when accessed again
      props = toggleProps.getState()({});
      expect(props['aria-pressed']).toBe(true);
    });
  });

  describe('mergeProps', () => {
    it('should correctly merge props from multiple sources', () => {
      // Create two separate API stores
      const baseStore = create(() => ({
        disabled: false,
        label: 'Base Button',
      }));

      const enhancedStore = create(() => ({
        selected: true,
        highlighted: false,
      }));

      // Create reactive APIs
      const baseApi: ReactiveApi = {
        use: {},
        getState: baseStore.getState,
        setState: baseStore.setState,
        subscribe: baseStore.subscribe,
      };

      const enhancedApi: ReactiveApi = {
        use: {},
        getState: enhancedStore.getState,
        setState: enhancedStore.setState,
        subscribe: enhancedStore.subscribe,
      };

      // Create base props
      const baseProps = createProps(
        'button',
        { baseApi },
        (get: () => { disabled: boolean; label: string }) => ({
          role: 'button',
          'aria-disabled': get().disabled,
          'data-label': get().label,
          onClick: () => console.log('Base click'),
        })
      );

      // Create enhanced props with some overlapping attributes
      const enhancedProps = createProps(
        'button',
        { enhancedApi },
        (get: () => { selected: boolean; highlighted: boolean }) => ({
          'aria-selected': get().selected,
          'data-highlighted': get().highlighted,
          className: 'enhanced-button',
          onClick: () => console.log('Enhanced click'),
        })
      );

      // Merge the props
      const mergedProps = mergeProps([baseProps, enhancedProps]);

      // The merged props should be a Zustand store
      expect(mergedProps).toBeDefined();
      expect(typeof mergedProps.getState).toBe('function');

      // Get the merged props
      const props = mergedProps.getState()({});

      // Should contain all properties from both sources
      expect(props.role).toBe('button');
      expect(props['aria-disabled']).toBe(false);
      expect(props['data-label']).toBe('Base Button');
      expect(props['aria-selected']).toBe(true);
      expect(props['data-highlighted']).toBe(false);
      expect(props.className).toBe('enhanced-button');

      // For conflicting properties (like onClick), the latter props should win
      expect(typeof props.onClick).toBe('function');

      // Test reactivity: changing the base store should update merged props
      baseStore.setState({ disabled: true });
      const updatedProps = mergedProps.getState()({});
      expect(updatedProps['aria-disabled']).toBe(true);

      // Test reactivity: changing the enhanced store should update merged props
      enhancedStore.setState({ highlighted: true });
      const finalProps = mergedProps.getState()({});
      expect(finalProps['data-highlighted']).toBe(true);
    });
  });
});

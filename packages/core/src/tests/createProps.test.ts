import { describe, it, expect, vi } from 'vitest';
import { createProps } from '../createProps';
import { create } from 'zustand';

interface ButtonParams {
  label?: string;
}

interface ButtonProps extends Record<string, unknown> {
  role: string;
  'aria-label': string;
  tabIndex: number;
  onClick: () => void;
}

// Type for the source store state and methods
interface SourceState {
  isSelected: boolean;
  isDisabled: boolean;
  select: () => void;
  deselect: () => void;
  disable: () => void;
  enable: () => void;
}

// Advanced params interface with multiple optional parameters
interface AdvancedParams {
  id: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
  testId?: string;
}

describe('createProps', () => {
  it('should create a props store with partName metadata', () => {
    // Create props store with partName and config
    const buttonProps = createProps<ButtonParams>('button', () => ({
      get: (params: ButtonParams): Record<string, unknown> => ({
        role: 'button',
        'aria-label': params.label || 'Button',
        tabIndex: 0,
        onClick: () => console.log('clicked'),
      }),
    }));

    // Verify the store structure includes partName metadata
    expect(buttonProps.partName).toBe('button');

    // Check that the store has a getState method
    expect(typeof buttonProps.getState).toBe('function');

    // Get the store state
    const state = buttonProps.getState();

    // Verify state includes the partName
    expect(state.partName).toBe('button');

    // Verify state has a get method
    expect(typeof state.get).toBe('function');

    // Call get to retrieve props
    const params = { label: 'Submit' };
    const props = state.get(params) as ButtonProps;

    // Check props include all attributes defined in config
    expect(props).toEqual({
      role: 'button',
      'aria-label': 'Submit',
      tabIndex: 0,
      onClick: expect.any(Function),
    });

    // Test calling the onClick handler
    const consoleSpy = vi.spyOn(console, 'log');
    props.onClick();
    expect(consoleSpy).toHaveBeenCalledWith('clicked');
    consoleSpy.mockRestore();
  });

  it('should store props with proper partName in both the store and state', () => {
    // Create props for multiple UI parts
    const menuProps = createProps('menu', () => ({
      get: () => ({ role: 'menu' }),
    }));

    const listProps = createProps('list', () => ({
      get: () => ({ role: 'list' }),
    }));

    // Verify each store has the correct partName directly on the store
    expect(menuProps.partName).toBe('menu');
    expect(listProps.partName).toBe('list');

    // Verify each store has the correct partName in its state
    expect(menuProps.getState().partName).toBe('menu');
    expect(listProps.getState().partName).toBe('list');
  });

  it('should update props reactively when underlying state changes', () => {
    // Create a source store with state that will be used in props
    const sourceStore = create<SourceState>((set) => ({
      isSelected: false,
      isDisabled: false,
      select: () => set({ isSelected: true }),
      deselect: () => set({ isSelected: false }),
      disable: () => set({ isDisabled: true }),
      enable: () => set({ isDisabled: false }),
    }));

    interface CheckboxProps extends Record<string, unknown> {
      role: string;
      'aria-checked': boolean;
      'aria-disabled': boolean;
      onClick: () => void;
    }

    // Create props that depend on the source store state
    const checkboxProps = createProps<Record<string, never>>(
      'checkbox',
      (set) => {
        // Setup subscription to source store
        sourceStore.subscribe(() => {
          // Trigger an update when the source store changes
          set({});
        });

        return {
          get: (): Record<string, unknown> => ({
            role: 'checkbox',
            'aria-checked': sourceStore.getState().isSelected,
            'aria-disabled': sourceStore.getState().isDisabled,
            onClick: () => {
              const state = sourceStore.getState();
              if (state.isSelected) {
                state.deselect();
              } else {
                state.select();
              }
            },
          }),
        };
      }
    );

    // Initial state
    const initialProps = checkboxProps.getState().get({}) as CheckboxProps;
    expect(initialProps['aria-checked']).toBe(false);
    expect(initialProps['aria-disabled']).toBe(false);

    // Change source store state
    sourceStore.getState().select();

    // The props should have reactively updated
    const updatedProps = checkboxProps.getState().get({}) as CheckboxProps;
    expect(updatedProps['aria-checked']).toBe(true);
    expect(updatedProps['aria-disabled']).toBe(false);

    // Change another piece of state
    sourceStore.getState().disable();

    // The props should update again
    const finalProps = checkboxProps.getState().get({}) as CheckboxProps;
    expect(finalProps['aria-checked']).toBe(true);
    expect(finalProps['aria-disabled']).toBe(true);

    // Test that the onClick handler correctly toggles the state
    finalProps.onClick();
    const afterClickProps = checkboxProps.getState().get({}) as CheckboxProps;
    expect(afterClickProps['aria-checked']).toBe(false);
    expect(afterClickProps['aria-disabled']).toBe(true);
  });

  it('should correctly handle different parameter types and optional values', () => {
    // Create a spy to track the parameters passed to the get method
    const getSpy = vi.fn().mockImplementation((params: AdvancedParams) => {
      // Build props based on the provided parameters
      const result: Record<string, unknown> = {
        id: params.id,
        role: 'button',
        className: params.className || '',
      };

      // Add size-specific classes
      if (params.size) {
        result.className += ` btn-${params.size}`;
      }

      // Add variant-specific classes
      if (params.variant) {
        result.className += ` btn-${params.variant}`;
      }

      // Add disabled state
      if (params.disabled) {
        result['aria-disabled'] = true;
        result.className += ' btn-disabled';
      }

      // Add data-testid if provided
      if (params.testId) {
        result['data-testid'] = params.testId;
      }

      return result;
    });

    // Create props with the spy
    const advancedProps = createProps<AdvancedParams>('button', () => ({
      get: getSpy,
    }));

    // Test with minimal required parameters
    const minimalProps = advancedProps.getState().get({ id: 'btn-1' });
    expect(getSpy).toHaveBeenCalledWith({ id: 'btn-1' });
    expect(minimalProps).toEqual({
      id: 'btn-1',
      role: 'button',
      className: '',
    });

    // Test with some optional parameters
    const someOptionalProps = advancedProps.getState().get({
      id: 'btn-2',
      size: 'large',
      variant: 'primary',
    });
    expect(getSpy).toHaveBeenCalledWith({
      id: 'btn-2',
      size: 'large',
      variant: 'primary',
    });
    expect(someOptionalProps).toEqual({
      id: 'btn-2',
      role: 'button',
      className: ' btn-large btn-primary',
    });

    // Test with all parameters
    const allProps = advancedProps.getState().get({
      id: 'btn-3',
      size: 'small',
      variant: 'secondary',
      disabled: true,
      className: 'custom-btn',
      testId: 'submit-button',
    });
    expect(getSpy).toHaveBeenCalledWith({
      id: 'btn-3',
      size: 'small',
      variant: 'secondary',
      disabled: true,
      className: 'custom-btn',
      testId: 'submit-button',
    });
    expect(allProps).toEqual({
      id: 'btn-3',
      role: 'button',
      className: 'custom-btn btn-small btn-secondary btn-disabled',
      'aria-disabled': true,
      'data-testid': 'submit-button',
    });

    // Test that params passed to get method don't affect subsequent calls
    const anotherCall = advancedProps.getState().get({ id: 'btn-4' });
    expect(getSpy).toHaveBeenCalledWith({ id: 'btn-4' });
    expect(anotherCall).toEqual({
      id: 'btn-4',
      role: 'button',
      className: '',
    });
  });
});

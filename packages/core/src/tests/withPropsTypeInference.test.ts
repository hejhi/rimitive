import { describe, it, expect } from 'vitest';
import { createProps } from '../createProps';
import { withProps } from '../withProps';
import { createLattice } from '../createLattice';

// Define the param types for better type safety
interface ButtonParams {
  id: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

// Define the props interface for type safety
interface ButtonProps {
  role: string;
  id: string;
  className: string;
  onClick: () => void;
  'aria-disabled'?: boolean;
}

describe('Type inference with createProps and withProps', () => {
  it('should correctly infer types with createProps alone', () => {
    // Direct usage with both generic parameters - the traditional way
    const explicitButtonProps = createProps<ButtonProps>(
      'button',
      (_set, _get) => ({
        get: (params: ButtonParams) => ({
          role: 'button',
          id: params.id,
          className: `btn btn-${params.variant || 'primary'} btn-${params.size || 'medium'}`,
          ...(params.disabled && { 'aria-disabled': true }),
          onClick: () => console.log(`Button ${params.id} clicked`),
        }),
      })
    );

    // This should be correctly typed
    const props = explicitButtonProps.getState().get({ id: 'test-btn' });
    expect(props.role).toBe('button');
    expect(props.id).toBe('test-btn');
  });

  it('should correctly infer types with withProps and createProps', () => {
    // Create base props - the traditional way
    const baseButtonProps = createProps<ButtonProps>(
      'button',
      (_set, _get) => ({
        get: (params: ButtonParams) => ({
          role: 'button',
          id: params.id,
          className: `btn btn-${params.variant || 'primary'} btn-${params.size || 'medium'}`,
          ...(params.disabled && { 'aria-disabled': true }),
          onClick: () => console.log(`Base button ${params.id} clicked`),
        }),
      })
    );

    // Create a base lattice
    const baseLattice = createLattice('uiKit', {
      props: { button: baseButtonProps },
    });

    // Direct usage with explicit type parameters - the traditional way
    const explicitcomposedProps = createProps<ButtonProps>(
      'button',
      withProps(baseLattice)((_set, _get, store) => ({
        get: () => {
          const baseProps = store.getBaseProps();
          return {
            ...baseProps,
            className: `${baseProps.className} composed`,
            onClick: () => {
              console.log('composed click');
              baseProps.onClick();
            },
          };
        },
      }))
    );

    // This should be correctly typed
    const composedProps = explicitcomposedProps
      .getState()
      .get({ id: 'composed-btn' });
    expect(composedProps.role).toBe('button');
    expect(composedProps.className).toContain('composed');
  });

  it('should correctly infer types with the recommended pattern', () => {
    // Create base props with the recommended pattern - return type at createProps level
    const baseButtonProps = createProps<ButtonProps>(
      'button',
      (_set, _get) => ({
        get: (params: ButtonParams) => ({
          role: 'button',
          id: params.id,
          className: `btn btn-${params.variant || 'primary'} btn-${params.size || 'medium'}`,
          ...(params.disabled && { 'aria-disabled': true }),
          onClick: () => console.log(`Base button ${params.id} clicked`),
        }),
      })
    );

    // Create a base lattice
    const baseLattice = createLattice('uiKit', {
      props: { button: baseButtonProps },
    });

    // Use withProps with the recommended pattern - return type at createProps level
    const composedProps = createProps<ButtonProps>(
      'button',
      withProps(baseLattice)((_set, _get, store) => ({
        get: (params: ButtonParams) => {
          const baseProps = store.getBaseProps();
          return {
            ...baseProps,
            id: params.id,
            className: `${baseProps.className} composed`,
            onClick: () => {
              console.log('composed click');
              baseProps.onClick();
            },
          };
        },
      }))
    );

    // This should be correctly typed
    const props = composedProps.getState().get({ id: 'composed-btn' });
    expect(props.role).toBe('button');
    expect(props.className).toContain('composed');
  });
});

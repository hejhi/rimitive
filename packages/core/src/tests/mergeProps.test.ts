import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { mergeProps } from '../mergeProps';
import { PropsState, PropsStore } from '../types';

describe('mergeProps', () => {
  // Test the enhanced functionality: organizing props stores by partName
  it('should organize props stores by their partName metadata', () => {
    // Create mock props stores with partName metadata
    const buttonProps = create<PropsState>(() => ({
      partName: 'button',
      get: () => ({ role: 'button' }),
    })) as unknown as PropsStore;

    const menuProps = create<PropsState>(() => ({
      partName: 'menu',
      get: () => ({ role: 'menu' }),
    })) as unknown as PropsStore;

    const listProps = create<PropsState>(() => ({
      partName: 'list',
      get: () => ({ role: 'list' }),
    })) as unknown as PropsStore;

    // Test organizing stores - pass as individual arguments
    const result = mergeProps(buttonProps, menuProps, listProps);

    // The result should be an object with props stores organized by partName
    expect(result).toEqual({
      button: buttonProps,
      menu: menuProps,
      list: listProps,
    });

    // Verify we didn't just get the first store's content
    expect(result).not.toEqual(buttonProps.getState());
  });

  // Test last store wins for the same partName (no merging)
  it('should use the last store when multiple stores have the same partName', () => {
    // Create two button stores with the same partName but different properties
    const buttonProps1 = create<PropsState>(() => ({
      partName: 'button',
      get: () => ({ role: 'button', variant: 'primary' }),
    })) as unknown as PropsStore;

    const buttonProps2 = create<PropsState>(() => ({
      partName: 'button',
      get: () => ({
        disabled: true,
        'aria-label': 'Action button',
      }),
    })) as unknown as PropsStore;

    // Also create a menu store with a different partName
    const menuProps = create<PropsState>(() => ({
      partName: 'menu',
      get: () => ({ role: 'menu' }),
    })) as unknown as PropsStore;

    // Merge all stores directly - last store with same partName should win
    const result = mergeProps(buttonProps1, buttonProps2, menuProps);

    // The button props should be the last one provided (buttonProps2)
    expect(result).toEqual({
      button: buttonProps2,
      menu: menuProps,
    });

    // Verify the button attributes reflect the second store, not a merge
    const buttonAttributes = result.button?.getState().get({});

    // Should contain properties ONLY from the second button store
    expect(buttonAttributes).toEqual({
      disabled: true,
      'aria-label': 'Action button',
    });

    // Should NOT contain properties from the first button store
    expect(buttonAttributes?.variant).toBeUndefined();
    expect(buttonAttributes?.role).toBeUndefined();
  });

  // Test warning and error for props store missing partName
  it('should warn and throw error when a props store is missing partName metadata', () => {
    // Create a mock props store without partName metadata
    const propsWithoutPartName = create<Partial<PropsState>>(() => ({
      get: () => ({ role: 'unknown' }),
    })) as unknown as PropsStore;

    // Mock console.warn
    const originalWarn = console.warn;
    console.warn = vi.fn();

    // Should throw error for missing partName
    expect(() => {
      mergeProps(propsWithoutPartName);
    }).toThrow('Props store missing partName metadata');

    // Should also have warned
    expect(console.warn).toHaveBeenCalledWith(
      'Props store missing partName metadata'
    );

    // Restore console.warn
    console.warn = originalWarn;
  });
});

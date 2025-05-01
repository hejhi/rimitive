import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { mergeProps } from '../mergeProps';

describe('mergeProps', () => {
  // Test the enhanced functionality: organizing props stores by partName
  it('should organize props stores by their partName metadata', () => {
    // Create mock props stores with partName metadata
    const buttonProps = create(() => ({
      partName: 'button',
      get: () => ({ role: 'button' }),
    }));

    const menuProps = create(() => ({
      partName: 'menu',
      get: () => ({ role: 'menu' }),
    }));

    const listProps = create(() => ({
      partName: 'list',
      get: () => ({ role: 'list' }),
    }));

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
    const buttonProps1 = create(() => ({
      partName: 'button',
      get: () => ({ role: 'button', variant: 'primary' }),
    }));

    const buttonProps2 = create(() => ({
      partName: 'button',
      get: () => ({ disabled: true, 'aria-label': 'Action button' }),
    }));

    // Also create a menu store with a different partName
    const menuProps = create(() => ({
      partName: 'menu',
      get: () => ({ role: 'menu' }),
    }));

    // Merge all stores directly - last store with same partName should win
    const result = mergeProps(buttonProps1, buttonProps2, menuProps);

    // The button props should be the last one provided (buttonProps2)
    expect(result).toEqual({
      button: buttonProps2,
      menu: menuProps,
    });

    // Verify the button attributes reflect the second store, not a merge
    const buttonAttributes = result.button.getState().get();

    // Should contain properties ONLY from the second button store
    expect(buttonAttributes).toEqual({
      disabled: true,
      'aria-label': 'Action button',
    });

    // Should NOT contain properties from the first button store
    expect(buttonAttributes.variant).toBeUndefined();
    expect(buttonAttributes.role).toBeUndefined();
  });

  // Test warning and error for props store missing partName
  it('should warn and throw error when a props store is missing partName metadata', () => {
    // Create a mock props store without partName metadata
    const propsWithoutPartName = create(() => ({
      get: () => ({ role: 'unknown' }),
    }));

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

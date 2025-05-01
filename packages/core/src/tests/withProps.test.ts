import { describe, it, expect, vi } from 'vitest';
import { createProps, PropsState } from '../createProps';
import { withProps } from '../withProps';
import { createLattice } from '../createLattice';

// Define the param types for better type safety
interface TreeItemParams {
  id: string;
  level?: number;
  isSelected?: boolean;
}

describe('withProps middleware', () => {
  it('should provide access to base props for manual merging', () => {
    // Create base props for the tree item
    const baseTreeItemProps = createProps<{ id: string; level?: number }>(
      'treeItem',
      (_set, _get) => ({
        get: (params) => ({
          role: 'treeitem',
          tabIndex: 0,
          style: {
            display: 'flex',
            padding: '4px',
            margin: '2px 0',
            backgroundColor: 'transparent',
          },
          data: {
            testId: `tree-item-${params.id}`,
            level: params.level || 0,
          },
          'aria-level': params.level || 1,
          onClick: () => console.log('base click'),
          onKeyDown: (e: { key: string }) => {
            if (e.key === 'Enter') {
              console.log('base Enter pressed');
            }
          },
        }),
      })
    );

    // Create a base lattice using the createLattice function
    const baseLattice = createLattice('baseTree', {
      props: {
        treeItem: baseTreeItemProps,
      },
    });

    // Create new props using withProps middleware and manually merge needed props
    const enhancedProps = createProps<TreeItemParams>(
      'treeItem',
      withProps(baseLattice)(
        (
          _set, // Note: Parameter order is set, get, baseProps (to match PropsConfigCreator)
          _get,
          baseProps: PropsState<TreeItemParams>
        ) => ({
          get: (params) => {
            // Get the base props explicitly
            const basePropValues = baseProps.get(params);

            return {
              // Inherit props we want to keep from the base
              role: basePropValues.role,
              'aria-level': basePropValues['aria-level'],

              // Override some existing attributes
              tabIndex: params.isSelected ? 0 : -1,

              // Manually merge nested style object
              style: {
                ...basePropValues.style, // Spread all base styles
                backgroundColor: params.isSelected
                  ? 'lightblue'
                  : 'transparent',
                borderLeft: '2px solid blue',
              },

              // Manually merge nested data object
              data: {
                ...basePropValues.data, // Spread all base data
                selected: params.isSelected,
              },

              // Add a new attribute
              'aria-selected': params.isSelected,

              // Override event handler but call the base handler
              onClick: (e: MouseEvent) => {
                console.log('enhanced click');
                // Explicitly call base onClick
                basePropValues.onClick(e);
              },
            };
          },
        })
      )
    );

    // Get props from both stores for the same params
    const params: TreeItemParams = { id: 'item-1', level: 2, isSelected: true };
    baseLattice.props.treeItem.getState().get(params);
    const enhancedTreeItemProps = enhancedProps.getState().get(params);

    // Test manually merged styles
    expect(enhancedTreeItemProps.style).toEqual({
      display: 'flex', // From base
      padding: '4px', // From base
      margin: '2px 0', // From base
      backgroundColor: 'lightblue', // Overridden
      borderLeft: '2px solid blue', // Added
    });

    // Test manually merged data object
    expect(enhancedTreeItemProps.data).toEqual({
      testId: 'tree-item-item-1', // From base
      level: 2, // From base
      selected: true, // Added
    });

    // Test overridden primitives
    expect(enhancedTreeItemProps.tabIndex).toBe(0);
    expect(enhancedTreeItemProps['aria-selected']).toBe(true);

    // Explicitly inherited attributes from base
    expect(enhancedTreeItemProps.role).toBe('treeitem');
    expect(enhancedTreeItemProps['aria-level']).toBe(2);

    // Event handlers should be composition functions that call both enhanced and base
    const mockEvent = { type: 'click' } as MouseEvent;
    const consoleSpy = vi.spyOn(console, 'log');
    enhancedTreeItemProps.onClick(mockEvent);

    // Should call both enhanced and base click handlers
    expect(consoleSpy).toHaveBeenCalledWith('enhanced click');
    expect(consoleSpy).toHaveBeenCalledWith('base click');

    consoleSpy.mockRestore();
  });
});

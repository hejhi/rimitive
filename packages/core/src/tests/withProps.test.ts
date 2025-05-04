import { describe, it, expect, vi } from 'vitest';
import { createProps } from '../createProps';
import { withProps } from '../withProps';
import { createLattice } from '../createLattice';

// Define the param types for better type safety
interface TreeItemParams {
  id: string;
  level?: number;
  isSelected?: boolean;
}

// Define the return type of the props for better type safety
interface TreeItemProps {
  role: string;
  tabIndex: number;
  style: {
    display: string;
    padding: string;
    margin: string;
    backgroundColor: string;
    borderLeft?: string;
  };
  data: {
    testId: string;
    level: number;
    selected?: boolean;
  };
  'aria-level': number;
  'aria-selected'?: boolean;
  onClick: (e: MouseEvent) => void;
  onKeyDown: (e: { key: string }) => void;
}

describe('withProps middleware', () => {
  it('should provide access to base props for manual merging', () => {
    // Create base props for the tree item with proper type inference
    const baseTreeItemProps = createProps(() => ({
      partName: 'treeItem',
      get: (params: TreeItemParams) => ({
        role: 'treeitem',
        tabIndex: 0,
        style: {
          display: 'flex',
          padding: '4px',
          margin: '2px 0',
          backgroundColor: 'transparent',
        },
        data: {
          testId: `tree-item-${params?.id || 'unknown'}`,
          level: params?.level || 0,
        },
        'aria-level': params?.level || 1,
        onClick: () => console.log('base click'),
        onKeyDown: (e: { key: string }) => {
          if (e.key === 'Enter') {
            console.log('base Enter pressed');
          }
        },
      }),
    }));

    // Create a base lattice using the createLattice function
    const baseLattice = createLattice<TreeItemParams>('baseTree', {
      props: {
        treeItem: baseTreeItemProps,
      },
    });

    // Create new props using withProps middleware and manually merge needed props
    const composedProps = createProps(
      withProps(
        baseLattice,
        'treeItem'
      )(
        (
          _set,
          _get,
          store: { getBaseProps: (params?: TreeItemParams) => TreeItemProps }
        ) => ({
          partName: 'treeItem',
          get: (inputParams?: TreeItemParams) => {
            if (!inputParams) {
              throw new Error('TreeItemParams is required');
            }

            // Get base props using the getBaseProps helper with same params
            // Pass the same params here to ensure consistency
            const basePropValues = store.getBaseProps(inputParams);

            return {
              // Inherit props we want to keep from the base
              role: basePropValues.role,
              'aria-level': basePropValues['aria-level'],

              // Override some existing attributes
              tabIndex: inputParams.isSelected ? 0 : -1,

              // Manually merge nested style object
              style: {
                ...basePropValues.style,
                backgroundColor: inputParams.isSelected
                  ? 'lightblue'
                  : 'transparent',
                borderLeft: '2px solid blue',
              },

              // Manually merge nested data object
              data: {
                ...basePropValues.data,
                selected: inputParams.isSelected,
              },

              // Add a new attribute
              'aria-selected': inputParams.isSelected,

              // Override event handler but call the base handler
              onClick: (e: MouseEvent) => {
                console.log('composed click');
                // Explicitly call base onClick
                basePropValues.onClick(e);
              },

              // Keep the onKeyDown handler from base
              onKeyDown: basePropValues.onKeyDown,
            };
          },
        })
      )
    );

    // Get props from both stores for the same params
    const params = {
      id: 'item-1',
      level: 2,
      isSelected: true,
    };
    baseLattice.props.treeItem?.getState().get(params);
    const composedTreeItemProps = composedProps.getState().get(params);

    // Test manually merged styles
    expect(composedTreeItemProps.style).toEqual({
      display: 'flex', // From base
      padding: '4px', // From base
      margin: '2px 0', // From base
      backgroundColor: 'lightblue', // Overridden
      borderLeft: '2px solid blue', // Added
    });

    // Test manually merged data object
    expect(composedTreeItemProps.data).toEqual({
      testId: 'tree-item-item-1', // From base
      level: 2, // From base
      selected: true, // Added
    });

    // Test overridden primitives
    expect(composedTreeItemProps.tabIndex).toBe(0);
    expect(composedTreeItemProps['aria-selected']).toBe(true);

    // Explicitly inherited attributes from base
    expect(composedTreeItemProps.role).toBe('treeitem');
    expect(composedTreeItemProps['aria-level']).toBe(2);

    // Event handlers should be composition functions that call both composed and base
    const mockEvent = { type: 'click' } as MouseEvent;
    const consoleSpy = vi.spyOn(console, 'log');
    composedTreeItemProps.onClick(mockEvent);

    // Should call both composed and base click handlers
    expect(consoleSpy).toHaveBeenCalledWith('composed click');
    expect(consoleSpy).toHaveBeenCalledWith('base click');

    consoleSpy.mockRestore();
  });
});

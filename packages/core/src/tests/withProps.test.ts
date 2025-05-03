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

// Define the return type for the tree item props
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
    const baseTreeItemProps = createProps<TreeItemParams, TreeItemProps>(
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
      })
    );

    // Create a base lattice using the createLattice function
    const baseLattice = createLattice<TreeItemParams>('baseTree', {
      props: {
        treeItem: baseTreeItemProps,
      },
    });

    // Create new props using withProps middleware and manually merge needed props
    const enhancedProps = createProps<TreeItemParams, TreeItemProps>(
      'treeItem',
      withProps(baseLattice)((_set, _get, store) => ({
        get: (inputParams: TreeItemParams) => {
          if (!inputParams) {
            throw new Error('TreeItemParams is required');
          }

          // Get base props using the getBaseProps helper with same params
          // Pass the same params here to ensure consistency
          const basePropValues = store.getBaseProps(
            inputParams
          ) as TreeItemProps;

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
              console.log('enhanced click');
              // Explicitly call base onClick
              basePropValues.onClick(e);
            },

            // Keep the onKeyDown handler from base
            onKeyDown: basePropValues.onKeyDown,
          };
        },
      }))
    );

    // Get props from both stores for the same params
    const params: TreeItemParams = {
      id: 'item-1',
      level: 2,
      isSelected: true,
    } as const;
    baseLattice.props.treeItem?.getState().get(params);
    const enhancedTreeItemProps = enhancedProps
      .getState()
      .get(params) as TreeItemProps;

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

import { describe, it, expect, vi } from 'vitest';
import { project } from './project';
import { createMockSelectors, createMockActions } from '../test-utils';
import { isViewFactory } from '../shared/identify';

describe('project() API', () => {
  it('should create parameterized views with clean syntax', () => {
    const mockSelectors = createMockSelectors({
      count: 42,
      isSelected: (id: string) => id === 'node-1',
      items: ['a', 'b', 'c'],
    });

    const mockActions = createMockActions({
      increment: vi.fn(),
      selectItem: vi.fn(),
      reset: vi.fn(),
    });

    // Create a parameterized view using project
    const itemView = project(mockSelectors, mockActions).toView(
      ({ selectors, actions }) =>
        (itemId: string) => ({
          'aria-selected': selectors().isSelected(itemId),
          'data-count': selectors().count,
          onClick: () => actions().selectItem(itemId),
        })
    );

    // Verify it's a proper ViewFactory
    expect(isViewFactory(itemView)).toBe(true);

    // Test factory pattern - actual execution happens in adapters
    const viewCreator = itemView();
    expect(typeof viewCreator).toBe('function');

    // The view creator expects to receive selectors/actions from the adapter
    // In real usage, the adapter would provide these with proper runtime values
  });

  it('should support multiple parameters', () => {
    const mockSelectors = createMockSelectors({
      theme: 'dark' as const,
    });

    const mockActions = createMockActions({
      toggleTheme: vi.fn(),
    });

    const themedButton = project(mockSelectors, mockActions).toView(
      ({ selectors, actions }) =>
        (label: string, variant: 'primary' | 'secondary' = 'primary') => ({
          'aria-label': label,
          'data-theme': selectors().theme,
          'data-variant': variant,
          onClick: actions().toggleTheme,
        })
    );

    expect(isViewFactory(themedButton)).toBe(true);
  });

  it('provides better type inference than from() API', () => {
    const mockSelectors = createMockSelectors({
      user: { name: 'Alice', role: 'admin' as const },
      permissions: {
        canEdit: true,
        canDelete: false,
      },
    });

    const mockActions = createMockActions({
      updateRole: vi.fn((_: 'admin' | 'user') => {}),
      deleteUser: vi.fn(),
    });

    // Direct access to nested properties with full type safety
    const userControls = project(mockSelectors, mockActions).toView(
      ({ selectors, actions }) =>
        (showDelete = false) => ({
          'data-user': selectors().user.name,
          'data-role': selectors().user.role,
          'data-can-edit': selectors().permissions.canEdit,
          'aria-label': `User controls for ${selectors().user.name}`,
          onRoleChange: () => actions().updateRole('user'),
          ...(showDelete &&
            selectors().permissions.canDelete && {
              onDelete: actions().deleteUser,
            }),
        })
    );

    expect(isViewFactory(userControls)).toBe(true);
  });

  it('returns views compatible with createComponent', () => {
    const mockSelectors = createMockSelectors({ value: 10 });
    const mockActions = createMockActions({ increment: vi.fn() });

    // Create view with project
    const counterView = project(mockSelectors, mockActions).toView(
      ({ selectors, actions }) =>
        () => ({
          'data-value': selectors().value,
          onClick: actions().increment,
        })
    );

    // The return type should be ViewFactory<TViewFunc, TSelectors, TActions>
    // not ViewFactory<TViewFunc, SelectorsFactory<TSelectors>, ActionsFactory<TActions>>
    // This makes it compatible with createComponent
    expect(isViewFactory(counterView)).toBe(true);
  });
});

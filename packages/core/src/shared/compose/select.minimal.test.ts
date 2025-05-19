/**
 * A minimal test for the select functionality that should pass both runtime and typecheck
 */

import { describe, it, expect, vi } from 'vitest';
import { compose } from './fluent';
import { brandWithSymbol } from '../identify';
import { SELECTORS_FACTORY_BRAND, VIEW_FACTORY_BRAND } from '../types';
import type { SelectorsFactory, ViewFactory } from '../types';

describe('Select Minimal Tests', () => {
  it('should select properties from selectors', () => {
    // Define base selectors type
    interface TestSelectors {
      count: number;
      name: string;
      isActive: boolean;
    }
    
    // Create a mock selectors factory with proper type
    const mockSelectorsFactory = () => (_: { get: () => any }) => ({
      count: 42,
      name: 'test',
      isActive: true
    });
    
    // Brand it properly
    const baseSelectorsFactory = brandWithSymbol(
      mockSelectorsFactory,
      SELECTORS_FACTORY_BRAND
    ) as SelectorsFactory<TestSelectors>;
    
    // Select a subset of properties
    type SelectedProps = {
      count: number;
      isActive: boolean;
    };
    
    // Use the select method
    const selectedFactory = compose<TestSelectors>(baseSelectorsFactory)
      .select<SelectedProps>((base) => ({
        count: base.count,
        isActive: base.isActive
        // name is intentionally omitted
      }));
    
    // Verify the factory works as expected
    const mockGet = vi.fn();
    const selectedProps = selectedFactory()({ get: mockGet });
    
    expect(selectedProps).toHaveProperty('count');
    expect(selectedProps).toHaveProperty('isActive');
    expect(selectedProps).not.toHaveProperty('name');
  });

  it('should select properties from views', () => {
    // Define base view type
    interface TestView {
      'aria-label': string;
      'data-count': number;
      onClick: () => void;
    }
    
    // Create a mock view factory with proper type
    const mockViewFactory = () => (_: { get: () => any, getSelectors?: () => any, getActions?: () => any }) => ({
      'aria-label': 'Test Label',
      'data-count': 42,
      onClick: vi.fn()
    });
    
    // Brand it properly
    const baseViewFactory = brandWithSymbol(
      mockViewFactory,
      VIEW_FACTORY_BRAND
    ) as ViewFactory<TestView>;
    
    // Select a subset of properties
    type SelectedView = {
      'aria-label': string;
      'data-count': number;
    };
    
    // Use the select method
    const selectedFactory = compose<TestView>(baseViewFactory)
      .select<SelectedView>((base) => ({
        'aria-label': base['aria-label'],
        'data-count': base['data-count']
        // onClick is intentionally omitted
      }));
    
    // Verify the factory works as expected
    const mockOptions = { 
      get: vi.fn(), 
      selectors: () => ({}), // Use the correct property names from ViewParamsToToolsAdapter
      actions: () => ({})  
    };
    const selectedView = selectedFactory()(mockOptions);
    
    expect(selectedView).toHaveProperty('aria-label');
    expect(selectedView).toHaveProperty('data-count');
    expect(selectedView).not.toHaveProperty('onClick');
  });
});

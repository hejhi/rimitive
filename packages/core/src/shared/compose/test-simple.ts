/**
 * Simple tests to verify branding of composition results
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from '../../model';
import { createSelectors } from '../../selectors';
import { createActions } from '../../actions';
import { createView } from '../../view';
import { compose } from './fluent';
import { 
  isModelFactory, 
  isSelectorsFactory,
  isActionsFactory,
  isViewFactory
} from '../identify';

describe('Simple Composition Branding Tests', () => {
  // Model 
  it('should properly brand model factories', () => {
    // Create a simple counter model
    const counterModel = createModel(() => ({
      count: 0,
      increment: () => {},
    }));
    
    // Verify base model is properly branded
    expect(isModelFactory(counterModel)).toBe(true);
    
    // Model wrapped with createModel should be branded
    const wrappedModel = createModel(() => ({ count: 1 }));
    expect(isModelFactory(wrappedModel)).toBe(true);
    
    // Raw composition is not branded
    const rawComposed = compose(counterModel).with(() => ({ doubled: () => 0 }));
    expect(isModelFactory(rawComposed)).toBe(false);
    
    // Composition wrapped with createModel should be branded
    const enhancedModel = createModel(rawComposed);
    expect(isModelFactory(enhancedModel)).toBe(true);
  });
  
  // Selectors
  it('should properly brand selectors factories', () => {
    // Mock model
    const mockModel = { count: 0 };
    
    // Create base selectors
    const counterSelectors = createSelectors({ model: mockModel }, () => ({
      count: 0,
      isPositive: true,
    }));
    
    // Verify base selectors are properly branded
    expect(isSelectorsFactory(counterSelectors)).toBe(true);
    
    // Selectors wrapped with createSelectors should be branded
    const wrappedSelectors = createSelectors({ model: mockModel }, () => ({ count: 1 }));
    expect(isSelectorsFactory(wrappedSelectors)).toBe(true);
  });
  
  // Actions
  it('should properly brand actions factories', () => {
    // Mock model
    const mockModel = { increment: vi.fn() };
    
    // Create base actions
    const counterActions = createActions({ model: mockModel }, () => ({
      increment: () => {},
    }));
    
    // Verify base actions are properly branded
    expect(isActionsFactory(counterActions)).toBe(true);
    
    // Actions wrapped with createActions should be branded
    const wrappedActions = createActions({ model: mockModel }, () => ({ reset: () => {} }));
    expect(isActionsFactory(wrappedActions)).toBe(true);
  });
  
  // View
  it('should properly brand view factories', () => {
    // Create mocks for selectors and actions
    const mockSelectors = { count: 5 };
    const mockActions = { increment: vi.fn() };
    
    // Create base view
    const counterView = createView(
      { selectors: mockSelectors, actions: mockActions },
      () => ({
        'data-count': 5,
        onClick: () => {},
      })
    );
    
    // Verify base view is properly branded
    expect(isViewFactory(counterView)).toBe(true);
    
    // View wrapped with createView should be branded
    const wrappedView = createView(
      { selectors: mockSelectors, actions: mockActions }, 
      () => ({ 'data-value': 10 })
    );
    expect(isViewFactory(wrappedView)).toBe(true);
  });
});
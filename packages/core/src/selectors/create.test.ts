/**
 * Test to validate selectors composition as specified in docs/spec.md
 * The tests focus on verifying the factory pattern and composition according to lines 140-162
 */

import { describe, it, expect } from 'vitest';
import { createSelectors } from './create';
import { isSelectorsFactory } from '../shared/identify';
import { SELECTORS_FACTORY_BRAND } from '../shared/types';

// Test selectors types as described in lines 142-151
type CounterSelectors = {
  count: number;
  isPositive: boolean;
};

// Type for our mock model
type CounterModel = {
  count: number;
  items: Array<{ name: string }>;
};

describe('Selectors Composition', () => {
  // Setup a mock model that matches the spec example
  const mockModel: CounterModel = {
    count: 10,
    items: [{ name: 'item1' }, { name: 'item2' }],
  };

  // Test branding to verify the factory pattern is correctly implemented
  it('should properly brand selectors factories with SELECTORS_FACTORY_BRAND', () => {
    // Create selectors for the mock model as shown in lines 142-151
    const counterSelectors = createSelectors<CounterSelectors, CounterModel>(
      { model: mockModel },
      ({ model }) => ({
        count: model().count,
        isPositive: model().count > 0,
      })
    );

    // Verify factory branding
    expect(isSelectorsFactory(counterSelectors)).toBe(true);
    expect(Reflect.has(counterSelectors, SELECTORS_FACTORY_BRAND)).toBe(true);
  });

  // Test basic functionality without composition
  it('should create selectors that access model properties and compute values', () => {
    // Create selectors with direct property and computed values
    // Following the pattern in lines 142-151
    const counterSelectors = createSelectors<
      CounterSelectors & {
        getFilteredItems: (filter: string) => Array<{ name: string }>;
      },
      CounterModel
    >({ model: mockModel }, ({ model }) => ({
      // Direct property access as in line 144
      count: model().count,

      // Computed value as in line 146
      isPositive: model().count > 0,

      // Function that computes value with runtime input as in lines 147-150
      getFilteredItems: (filter: string) =>
        model().items.filter((item) => item.name.includes(filter)),
    }));

    // Verify factory branding
    expect(isSelectorsFactory(counterSelectors)).toBe(true);

    // Get the selectors by invoking the factory with the model
    const selectors = counterSelectors()({ model: () => mockModel });

    // Verify the shape of the generated selectors
    expect(selectors.count).toBe(10);
    expect(selectors.isPositive).toBe(true);
    expect(typeof selectors.getFilteredItems).toBe('function');

    // Test the filtering function
    expect(selectors.getFilteredItems('item').length).toBe(2);
    expect(selectors.getFilteredItems('item1').length).toBe(1);
  });

  // Test enhanced selectors with additional derived values
  it('should support creating enhanced selectors with additional derived values', () => {
    // Create enhanced selectors following the pattern in lines 154-159
    const enhancedSelectors = createSelectors<
      CounterSelectors & {
        doubled: number;
        isEven: boolean;
      },
      CounterModel
    >({ model: mockModel }, ({ model }) => ({
      // Basic selectors
      count: model().count,
      isPositive: model().count > 0,

      // Enhanced selectors with derived values
      doubled: model().count * 2,
      isEven: model().count % 2 === 0,
    }));

    // Verify factory branding
    expect(isSelectorsFactory(enhancedSelectors)).toBe(true);

    // Get the enhanced selectors by invoking the factory with the model
    const selectors = enhancedSelectors()({ model: () => mockModel });

    // Verify the shape has both original and new properties
    expect(selectors).toHaveProperty('count');
    expect(selectors).toHaveProperty('isPositive');
    expect(selectors).toHaveProperty('doubled');
    expect(selectors).toHaveProperty('isEven');

    // Verify the values match what we expect
    expect(selectors.count).toBe(10);
    expect(selectors.doubled).toBe(20);
    expect(selectors.isEven).toBe(true);
  });
});

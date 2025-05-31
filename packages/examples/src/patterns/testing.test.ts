/**
 * @fileoverview Testing Pattern
 * 
 * This example shows how Lattice enables you to test your behavior
 * specifications once and be confident they work with any adapter.
 * Write tests against the behavior, not the implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createComponentTest } from '@lattice/test-utils';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createMemoryAdapter } from '@lattice/adapter-memory';

import { 
  userComponent, 
  cartComponent, 
  dashboardComponent 
} from '../slices';

// ============================================================================
// Test behavior specifications independently
// ============================================================================
describe('User Component Behavior', () => {
  it('should handle login flow correctly', async () => {
    const test = createComponentTest(userComponent);
    
    // Initial state
    expect(test.store.getState().user).toBeNull();
    expect(test.store.getState().isLoading).toBe(false);
    
    // Start login
    const loginPromise = test.store.actions.login('test@example.com', 'password');
    
    // Should be loading
    expect(test.store.getState().isLoading).toBe(true);
    
    // Wait for completion
    await loginPromise;
    
    // Should have user
    expect(test.store.getState().user).toEqual({
      id: '1',
      name: 'John Doe',
      email: 'test@example.com'
    });
    expect(test.store.getState().isLoading).toBe(false);
    
    // Test the view
    const profile = test.views.userProfile();
    expect(profile.children).toContain('Welcome, John Doe');
    expect(profile.className).toBe('profile-active');
  });
  
  it('should handle logout correctly', async () => {
    const test = createComponentTest(userComponent);
    
    // Login first
    await test.store.actions.login('test@example.com', 'password');
    expect(test.store.getState().user).toBeTruthy();
    
    // Logout
    test.store.actions.logout();
    expect(test.store.getState().user).toBeNull();
    
    // View should update
    const profile = test.views.userProfile();
    expect(profile.children).toBe('Not logged in');
    expect(profile.className).toBe('profile-inactive');
  });
});

describe('Cart Component Behavior', () => {
  it('should add items correctly', () => {
    const test = createComponentTest(cartComponent);
    
    // Add first item
    test.store.actions.addItem({
      id: '1',
      name: 'Product 1',
      price: 10.00
    });
    
    expect(test.store.getState().items).toHaveLength(1);
    expect(test.store.getState().items[0].quantity).toBe(1);
    
    // Add same item again - should increment quantity
    test.store.actions.addItem({
      id: '1',
      name: 'Product 1',
      price: 10.00
    });
    
    expect(test.store.getState().items).toHaveLength(1);
    expect(test.store.getState().items[0].quantity).toBe(2);
    
    // Check view
    const summary = test.views.cartSummary();
    expect(summary.children).toBe('2 items - $20.00');
    expect(summary['data-item-count']).toBe(2);
  });
  
  it('should calculate totals correctly', () => {
    const test = createComponentTest(cartComponent);
    
    // Add multiple items
    test.store.actions.addItem({
      id: '1',
      name: 'Cheap Item',
      price: 5.99
    });
    
    test.store.actions.addItem({
      id: '2',
      name: 'Expensive Item',
      price: 99.99
    });
    
    // Update quantity
    test.store.actions.updateQuantity('1', 3);
    
    const state = test.store.getState();
    const summary = test.views.cartSummary();
    
    // 3 * 5.99 + 1 * 99.99 = 117.96
    expect(summary.children).toBe('4 items - $117.96');
  });
});

// ============================================================================
// Test that behavior works identically across adapters
// ============================================================================
describe('Cross-Adapter Compatibility', () => {
  const adapters = [
    { name: 'Test Adapter', create: () => createComponentTest(cartComponent) },
    { name: 'Zustand', create: () => ({ store: createZustandAdapter(cartComponent), views: createZustandAdapter(cartComponent).views }) },
    { name: 'Redux', create: () => ({ store: createReduxAdapter(cartComponent), views: createReduxAdapter(cartComponent).views }) },
    { name: 'Memory', create: () => createMemoryAdapter().executeComponent(cartComponent) },
  ];
  
  adapters.forEach(({ name, create }) => {
    describe(`${name}`, () => {
      let adapter: any;
      
      beforeEach(() => {
        adapter = create();
      });
      
      it('should handle cart operations identically', async () => {
        // Helper to get state/actions based on adapter type
        const getState = () => {
          if (name === 'Memory') {
            return adapter.model.get().cart;
          }
          return adapter.store.getState();
        };
        
        const actions = name === 'Memory' ? adapter.actions : adapter.store.actions;
        
        // Add items
        actions.addItem({ id: '1', name: 'Item 1', price: 10 });
        actions.addItem({ id: '2', name: 'Item 2', price: 20 });
        
        const state = getState();
        expect(state.items).toHaveLength(2);
        
        // Remove item
        actions.removeItem('1');
        
        const newState = getState();
        expect(newState.items).toHaveLength(1);
        expect(newState.items[0].id).toBe('2');
        
        // Clear cart
        actions.clear();
        
        const finalState = getState();
        expect(finalState.items).toHaveLength(0);
      });
    });
  });
});

// ============================================================================
// Integration testing with composed components
// ============================================================================
describe('Dashboard Integration', () => {
  it('should coordinate between multiple components', async () => {
    const test = createComponentTest(dashboardComponent);
    
    // Login through dashboard
    await test.store.actions.login('dashboard@test.com', 'password');
    
    // Add items to cart through dashboard
    test.store.actions.addToCart({ id: '1', name: 'Dashboard Item', price: 25 });
    
    // Change theme through dashboard
    test.store.actions.setTheme('dark');
    
    // Test composed view
    const header = test.views.header();
    expect(header.children).toContain('John Doe'); // From user
    expect(header.children).toContain('1 items in cart'); // From cart
    expect(header.className).toContain('dark'); // From theme
  });
});

// ============================================================================
// Snapshot testing for views
// ============================================================================
describe('View Consistency', () => {
  it('should generate consistent view attributes', () => {
    const test = createComponentTest(cartComponent);
    
    // Set up specific state
    test.store.actions.addItem({ id: '1', name: 'Test Item', price: 9.99 });
    test.store.actions.addItem({ id: '2', name: 'Another Item', price: 19.99 });
    
    const summary = test.views.cartSummary();
    
    // This ensures view output is predictable
    expect(summary).toEqual({
      className: 'cart-has-items',
      'data-item-count': 2,
      'aria-label': 'Cart with 2 items',
      children: '2 items - $29.98'
    });
  });
});

// ============================================================================
// Performance testing
// ============================================================================
describe('Performance Characteristics', () => {
  it('should handle large numbers of items efficiently', () => {
    const test = createComponentTest(cartComponent);
    
    const startTime = performance.now();
    
    // Add 1000 items
    for (let i = 0; i < 1000; i++) {
      test.store.actions.addItem({
        id: `item-${i}`,
        name: `Item ${i}`,
        price: Math.random() * 100
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete in reasonable time
    expect(duration).toBeLessThan(100); // 100ms for 1000 items
    
    // State should be correct
    expect(test.store.getState().items).toHaveLength(1000);
  });
});
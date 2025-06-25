import { describe, expect, it } from 'vitest';

// Import the signal functions (will implement these in runtime.ts)
import { signal, computed } from './runtime';

describe('signals core', () => {
  it('should create writable signal', () => {
    const count = signal(0);
    
    // Read value
    expect(count()).toBe(0);
    
    // Write value
    count(5);
    expect(count()).toBe(5);
  });

  it('should notify subscribers on signal changes', () => {
    const count = signal(0);
    let notificationCount = 0;
    
    const unsubscribe = count.subscribe(() => {
      notificationCount++;
    });
    
    count(1);
    expect(notificationCount).toBe(1);
    
    count(2);
    expect(notificationCount).toBe(2);
    
    // Same value should not notify
    count(2);
    expect(notificationCount).toBe(2);
    
    unsubscribe();
    count(3);
    expect(notificationCount).toBe(2); // Should not notify after unsubscribe
  });

  it('should create computed signal with automatic dependency tracking', () => {
    const a = signal(5);
    const b = signal(10);
    
    const sum = computed(() => a() + b());
    
    expect(sum()).toBe(15);
    
    a(3);
    expect(sum()).toBe(13);
    
    b(7);
    expect(sum()).toBe(10);
  });

  it('should notify computed subscribers when dependencies change', () => {
    const count = signal(0);
    const doubled = computed(() => count() * 2);
    
    // Need to read the computed first to set up dependencies!
    expect(doubled()).toBe(0);
    
    let notificationCount = 0;
    const unsubscribe = doubled.subscribe(() => {
      notificationCount++;
    });
    
    count(5);
    expect(notificationCount).toBe(1);
    expect(doubled()).toBe(10);
    
    unsubscribe();
    count(10);
    expect(notificationCount).toBe(1); // Should not notify after unsubscribe
  });

  it('should handle computed with no dependencies', () => {
    const constant = computed(() => 42);
    expect(constant()).toBe(42);
  });

  it('should handle nested computed dependencies', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a() + b());
    const product = computed(() => sum() * 4);
    
    expect(product()).toBe(20); // (2 + 3) * 4
    
    a(5);
    expect(product()).toBe(32); // (5 + 3) * 4
  });

  it('should clean up computed dependencies when they change', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(2);
    
    let aNotifications = 0;
    let bNotifications = 0;
    
    a.subscribe(() => aNotifications++);
    b.subscribe(() => bNotifications++);
    
    const conditional = computed(() => {
      return condition() ? a() : b();
    });
    
    // Initially depends on 'a'
    expect(conditional()).toBe(1);
    
    // Change 'a' - should update conditional
    a(10);
    expect(conditional()).toBe(10);
    expect(aNotifications).toBe(1);
    expect(bNotifications).toBe(0);
    
    // Switch to depend on 'b'
    condition(false);
    expect(conditional()).toBe(2);
    
    // Now changing 'a' should not affect conditional
    a(20);
    expect(conditional()).toBe(2); // Still 2, not affected by 'a'
    expect(aNotifications).toBe(2);
    
    // But changing 'b' should
    b(30);
    expect(conditional()).toBe(30);
    expect(bNotifications).toBe(1);
  });
});
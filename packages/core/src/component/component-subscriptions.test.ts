import { describe, it, expect } from 'vitest';
import type { ComponentContext } from './types';
import {
  createTestComponent,
  CounterComponent,
  type NamedCounterState,
} from '../../testing/test-utils';

describe('Component Subscriptions', () => {
  it('should support fine-grained subscriptions', () => {
    const Counter = ({ store, set }: ComponentContext<NamedCounterState>) => {
      return {
        count: store.count,
        name: store.name,
        increment: () => set(store.count, store.count.value + 1),
        setName: (n: string) => set(store.name, n),
      };
    };

    const store = createTestComponent({ count: 0, name: 'initial' });
    const component = Counter(store);

    let countUpdates = 0;
    let nameUpdates = 0;

    const unsubCount = component.count.subscribe(() => countUpdates++);
    const unsubName = component.name.subscribe(() => nameUpdates++);

    component.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(0);

    component.setName('updated');
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);

    unsubCount();
    unsubName();

    component.increment();
    expect(countUpdates).toBe(1); // No more updates after unsubscribe
    expect(nameUpdates).toBe(1);
  });

  it('should update computed values when dependencies change', () => {
    interface MultiState {
      a: number;
      b: number;
    }

    const Multi = ({ store, computed, set }: ComponentContext<MultiState>) => {
      const sum = computed(() => store.a.value + store.b.value);

      return {
        a: store.a,
        b: store.b,
        sum,
        updateBoth: () => {
          set(store.a, store.a.value + 1);
          set(store.b, store.b.value + 1);
        },
      };
    };

    const store = createTestComponent({ a: 1, b: 2 });
    const component = Multi(store);

    expect(component.sum.value).toBe(3);

    component.updateBoth();
    expect(component.sum.value).toBe(5);

    // Verify individual updates work too
    store.set(store.store.a, 10);
    expect(component.sum.value).toBe(13); // 10 + 3 (b is still 3 from updateBoth)
  });

  it('should handle subscription cleanup', () => {
    const store = createTestComponent({ count: 0 });
    const component = CounterComponent(store);

    const subscriptions: (() => void)[] = [];
    let totalUpdates = 0;

    // Create multiple subscriptions
    for (let i = 0; i < 5; i++) {
      subscriptions.push(component.count.subscribe(() => totalUpdates++));
    }

    component.increment();
    expect(totalUpdates).toBe(5); // All 5 subscriptions fired

    // Unsubscribe some
    subscriptions[0]?.();
    subscriptions[1]?.();

    totalUpdates = 0;
    component.increment();
    expect(totalUpdates).toBe(3); // Only 3 remaining subscriptions

    // Cleanup rest
    subscriptions.slice(2).forEach((unsub) => unsub());

    totalUpdates = 0;
    component.increment();
    expect(totalUpdates).toBe(0); // No subscriptions left
  });

  it('should support computed value subscriptions', () => {
    interface State {
      items: string[];
      filter: string;
    }

    const Filtered = ({ store, computed }: ComponentContext<State>) => {
      const filtered = computed(() =>
        store.items.value.filter((item) => item.includes(store.filter.value))
      );

      return {
        items: store.items,
        filter: store.filter,
        filtered,
      };
    };

    const store = createTestComponent({
      items: ['apple', 'banana', 'cherry'],
      filter: 'a',
    });
    const component = Filtered(store);

    let filterUpdates = 0;
    const unsubscribe = component.filtered.subscribe(() => filterUpdates++);

    expect(component.filtered.value).toEqual(['apple', 'banana']);

    // Changing filter should trigger update
    store.set(store.store.filter, 'e');
    expect(filterUpdates).toBe(1);
    expect(component.filtered.value).toEqual(['apple', 'cherry']);

    // Changing items should also trigger update
    store.set(store.store.items, [...store.store.items.value, 'elderberry']);
    expect(filterUpdates).toBe(2);
    expect(component.filtered.value).toEqual(['apple', 'cherry', 'elderberry']);

    unsubscribe();
  });

  it('should support effect for automatic dependency tracking', () => {
    interface State {
      count: number;
      multiplier: number;
      enabled: boolean;
    }

    const Calculator = ({ store, computed, set }: ComponentContext<State>) => {
      const result = computed(() =>
        store.enabled.value ? store.count.value * store.multiplier.value : 0
      );

      return {
        count: store.count,
        multiplier: store.multiplier,
        enabled: store.enabled,
        result,
        increment: () => set(store.count, store.count.value + 1),
        setMultiplier: (m: number) => set(store.multiplier, m),
        toggle: () => set(store.enabled, !store.enabled.value),
      };
    };

    const store = createTestComponent({
      count: 5,
      multiplier: 2,
      enabled: true,
    });
    const component = Calculator(store);

    let effectRuns = 0;
    let lastResult = 0;

    // Use effect to track any accessed signals automatically
    const unsubscribe = store.effect(() => {
      // This will track whatever signals are accessed
      lastResult = component.result.value;
      effectRuns++;
    });

    // Initial run
    expect(effectRuns).toBe(1);
    expect(lastResult).toBe(10);

    // Changing count triggers effect (result depends on count)
    component.increment();
    expect(effectRuns).toBe(2);
    expect(lastResult).toBe(12);

    // Changing multiplier triggers effect (result depends on multiplier)
    component.setMultiplier(3);
    expect(effectRuns).toBe(3);
    expect(lastResult).toBe(18);

    // Toggling to disabled triggers effect
    component.toggle();
    expect(effectRuns).toBe(4);
    expect(lastResult).toBe(0);

    // While disabled, changing count does NOT trigger effect
    // (because when enabled is false, count() is never accessed in the computed)
    component.increment();
    expect(effectRuns).toBe(4);
    expect(lastResult).toBe(0);

    unsubscribe();

    // After unsubscribe, no more effects
    component.toggle();
    component.increment();
    expect(effectRuns).toBe(4);
  });

  it('should batch effect runs when multiple dependencies change', () => {
    const ctx = createTestComponent({ a: 1, b: 2, c: 3 });

    let effectRuns = 0;
    let lastSum = 0;

    // Effect that depends on all three values
    const unsubscribe = ctx.effect(() => {
      lastSum = ctx.store.a.value + ctx.store.b.value + ctx.store.c.value;
      effectRuns++;
    });

    // Initial run
    expect(effectRuns).toBe(1);
    expect(lastSum).toBe(6);

    // Update all three values in a batch
    ctx.set(ctx.store, { a: 10, b: 20, c: 30 });

    // Effect should only run once despite three dependencies changing
    expect(effectRuns).toBe(2);
    expect(lastSum).toBe(60);

    unsubscribe();
  });

  it('should support runtime computed creation for dynamic derived state', () => {
    interface CartState {
      items: Array<{ id: string; price: number; quantity: number }>;
      taxRate: number;
      discountPercent: number;
    }

    const Cart = ({ store, set }: ComponentContext<CartState>) => ({
      items: store.items,
      taxRate: store.taxRate,
      discountPercent: store.discountPercent,
      addItem: (item: { id: string; price: number; quantity: number }) =>
        set(store.items, [...store.items.value, item]),
      setTaxRate: (rate: number) => set(store.taxRate, rate),
      setDiscount: (percent: number) => set(store.discountPercent, percent),
    });

    const ctx = createTestComponent<CartState>({
      items: [
        { id: 'a', price: 10, quantity: 2 },
        { id: 'b', price: 20, quantity: 1 },
      ],
      taxRate: 0.08,
      discountPercent: 10,
    });
    const cart = Cart(ctx);

    // Create computed values at runtime using the context
    const subtotal = ctx.computed(() =>
      cart.items.value.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      )
    );

    const discountAmount = ctx.computed(
      () => (subtotal.value * cart.discountPercent.value) / 100
    );

    const taxableAmount = ctx.computed(
      () => subtotal.value - discountAmount.value
    );

    const tax = ctx.computed(() => taxableAmount.value * cart.taxRate.value);

    const total = ctx.computed(() => taxableAmount.value + tax.value);

    // Verify initial calculations
    expect(subtotal.value).toBe(40); // (10*2) + (20*1)
    expect(discountAmount.value).toBe(4); // 40 * 10%
    expect(taxableAmount.value).toBe(36); // 40 - 4
    expect(tax.value).toBe(2.88); // 36 * 8%
    expect(total.value).toBe(38.88); // 36 + 2.88

    // Track how many times computeds recalculate
    let subtotalCalcs = 0;
    let totalCalcs = 0;

    const unsubSubtotal = subtotal.subscribe(() => subtotalCalcs++);
    const unsubTotal = total.subscribe(() => totalCalcs++);

    // Add a new item - should trigger recalculation chain
    cart.addItem({ id: 'c', price: 30, quantity: 1 });

    expect(subtotalCalcs).toBe(1);
    // Total depends on subtotal through multiple computeds, may recalculate multiple times
    expect(totalCalcs).toBeGreaterThanOrEqual(1);
    expect(subtotal.value).toBe(70); // 40 + 30
    
    // The calculation should be: (70 - 7) * 1.08 = 68.04
    expect(total.value).toBeCloseTo(68.04);

    // Reset counters for clearer testing
    subtotalCalcs = 0;
    totalCalcs = 0;

    // Change discount - affects total but not subtotal
    cart.setDiscount(20);

    expect(subtotalCalcs).toBe(0); // subtotal unchanged
    expect(totalCalcs).toBeGreaterThanOrEqual(1); // total recalculated
    expect(discountAmount.value).toBe(14); // 70 * 20%
    expect(total.value).toBeCloseTo(60.48); // (70 - 14) * 1.08

    // Reset counter
    totalCalcs = 0;

    // Change tax rate - affects total but not subtotal
    cart.setTaxRate(0.1);

    expect(subtotalCalcs).toBe(0); // subtotal still unchanged
    expect(totalCalcs).toBeGreaterThanOrEqual(1); // total recalculated again
    expect(total.value).toBeCloseTo(61.6); // (70 - 14) * 1.10

    // Create a new computed at runtime that depends on existing computeds
    const formattedTotal = ctx.computed(() => `$${total.value.toFixed(2)}`);

    expect(formattedTotal.value).toBe('$61.60');

    // Verify the new computed is reactive
    let formatCalcs = 0;
    const unsubFormat = formattedTotal.subscribe(() => formatCalcs++);

    cart.setTaxRate(0.05);
    expect(formatCalcs).toBe(1);
    expect(formattedTotal.value).toBe('$58.80');

    // Cleanup
    unsubSubtotal();
    unsubTotal();
    unsubFormat();
  });
});

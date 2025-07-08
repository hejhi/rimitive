import { describe, it, expect } from 'vitest';
import { createStore, Store } from '../store';

describe('Component with Store Pattern', () => {
  it('should create a basic component with store', () => {
    interface CounterState {
      count: number;
    }

    const Counter = (store: Store<CounterState>) => {
      return {
        get count() {
          return store.state.count.value;
        },
        increment: () => store.state.count.value++,
        decrement: () => store.state.count.value--,
        reset: () => (store.state.count.value = 0),
      };
    };

    const store = createStore<CounterState>({ count: 0 });
    const counter = Counter(store);

    expect(counter.count).toBe(0);

    counter.increment();
    expect(counter.count).toBe(1);

    counter.increment();
    expect(counter.count).toBe(2);

    counter.decrement();
    expect(counter.count).toBe(1);

    counter.reset();
    expect(counter.count).toBe(0);

    store.dispose();
  });

  it('should support computed values', () => {
    interface CalculatorState {
      a: number;
      b: number;
    }

    const Calculator = (store: Store<CalculatorState>) => {
      const ctx = store.getContext();

      const sum = ctx.computed(() => store.state.a.value + store.state.b.value);

      const product = ctx.computed(
        () => store.state.a.value * store.state.b.value
      );

      return {
        get a() {
          return store.state.a.value;
        },
        get b() {
          return store.state.b.value;
        },
        get sum() {
          return sum.value;
        },
        get product() {
          return product.value;
        },
        setA: (value: number) => (store.state.a.value = value),
        setB: (value: number) => (store.state.b.value = value),
      };
    };

    const store = createStore<CalculatorState>({ a: 3, b: 4 });
    const calc = Calculator(store);

    expect(calc.sum).toBe(7);
    expect(calc.product).toBe(12);

    calc.setA(5);
    expect(calc.sum).toBe(9);
    expect(calc.product).toBe(20);

    calc.setB(10);
    expect(calc.sum).toBe(15);
    expect(calc.product).toBe(50);

    store.dispose();
  });

  it('should support effects for reactive side effects', () => {
    interface TrackedState {
      value: number;
      lastChanged: number;
    }

    const TrackedValue = (store: Store<TrackedState>) => {
      const ctx = store.getContext();
      const history: number[] = [];

      // Effect to track value changes
      ctx.effect(() => {
        const currentValue = store.state.value.value;
        history.push(currentValue);
      });

      return {
        get value() {
          return store.state.value.value;
        },
        get lastChanged() {
          return store.state.lastChanged.value;
        },
        updateValue: (value: number) =>
          store.set({
            value,
            lastChanged: Date.now(),
          }),
        history,
      };
    };

    const store = createStore<TrackedState>({
      value: 0,
      lastChanged: Date.now(),
    });
    const tracked = TrackedValue(store);

    expect(tracked.history).toEqual([0]); // Initial effect run

    tracked.updateValue(5);
    expect(tracked.value).toBe(5);
    expect(tracked.history).toEqual([0, 5]);

    tracked.updateValue(10);
    expect(tracked.history).toEqual([0, 5, 10]);

    store.dispose();
  });

  it('should support component composition', () => {
    // Sub-component state
    interface PriceState {
      basePrice: number;
      taxRate: number;
    }

    // Parent component state includes sub-component state
    interface ProductState extends PriceState {
      name: string;
      quantity: number;
    }

    // Price calculator component (can be used independently)
    const PriceCalculator = (store: Store<PriceState>) => {
      const ctx = store.getContext();

      const totalPrice = ctx.computed(() => {
        const base = store.state.basePrice.value;
        const tax = store.state.taxRate.value;
        return base * (1 + tax);
      });

      return {
        get basePrice() {
          return store.state.basePrice.value;
        },
        get taxRate() {
          return store.state.taxRate.value;
        },
        get totalPrice() {
          return totalPrice.value;
        },
        setBasePrice: (price: number) => (store.state.basePrice.value = price),
        setTaxRate: (rate: number) => (store.state.taxRate.value = rate),
      };
    };

    // Product component that composes PriceCalculator
    const Product = (store: Store<ProductState>) => {
      const ctx = store.getContext();

      // Compose the pricing component with the same store
      const pricing = PriceCalculator(store);

      const totalValue = ctx.computed(
        () => pricing.totalPrice * store.state.quantity.value
      );

      return {
        get name() {
          return store.state.name.value;
        },
        get quantity() {
          return store.state.quantity.value;
        },
        pricing,
        get totalValue() {
          return totalValue.value;
        },
        setQuantity: (qty: number) => (store.state.quantity.value = qty),
      };
    };

    const store = createStore<ProductState>({
      name: 'Widget',
      basePrice: 10,
      taxRate: 0.08,
      quantity: 5,
    });

    const product = Product(store);

    // Test composition
    expect(product.name).toBe('Widget');
    expect(product.pricing.basePrice).toBe(10);
    expect(product.pricing.totalPrice).toBe(10.8); // 10 * 1.08
    expect(product.totalValue).toBe(54); // 10.8 * 5

    // Update via composed component
    product.pricing.setBasePrice(20);
    expect(product.pricing.totalPrice).toBe(21.6); // 20 * 1.08
    expect(product.totalValue).toBe(108); // 21.6 * 5

    // Update quantity
    product.setQuantity(3);
    expect(product.totalValue).toBeCloseTo(64.8, 10); // 21.6 * 3

    store.dispose();
  });

  it('should support batched updates', () => {
    interface FormState {
      firstName: string;
      lastName: string;
      email: string;
      isValid: boolean;
    }

    const Form = (store: Store<FormState>) => {
      const ctx = store.getContext();

      const fullName = ctx.computed(() =>
        `${store.state.firstName.value} ${store.state.lastName.value}`.trim()
      );

      return {
        get fullName() {
          return fullName.value;
        },
        updateAll: (updates: Partial<FormState>) => store.set(updates),
        validate: () => {
          const email = store.state.email.value;
          const isValid = email.includes('@') && fullName.value.length > 0;
          store.state.isValid.value = isValid;
        },
      };
    };

    const store = createStore<FormState>({
      firstName: '',
      lastName: '',
      email: '',
      isValid: false,
    });

    const form = Form(store);

    // Test batched updates
    form.updateAll({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    });

    expect(form.fullName).toBe('John Doe');
    expect(store.state.email.value).toBe('john@example.com');

    // Test validation
    form.validate();
    expect(store.state.isValid.value).toBe(true);

    // Test that partial updates work
    form.updateAll({ firstName: 'Jane' });
    expect(form.fullName).toBe('Jane Doe');
    expect(store.state.email.value).toBe('john@example.com'); // unchanged

    store.dispose();
  });
});

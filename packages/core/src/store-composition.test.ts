import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';
import { getSliceMetadata } from './utils';

describe('Store Composition via Computed State', () => {
  it('should support composition by passing computed values between slices', () => {
    const createSlice = createStore({ 
      products: [
        { id: '1', name: 'Widget', active: true },
        { id: '2', name: 'Gadget', active: false },
        { id: '3', name: 'Tool', active: true }
      ],
      stock: { '1': 5, '2': 0, '3': 10 }
    });

    // First slice handles products
    const productSlice = createSlice(
      (selectors) => ({ products: selectors.products }),
      ({ products }, set) => ({
        all: () => products(),
        active: () => products().filter(p => p.active),
        toggleActive: (id: string) => set(
          (selectors) => ({ products: selectors.products }),
          ({ products }) => ({
            products: products().map(p => 
              p.id === id ? { ...p, active: !p.active } : p
            )
          })
        )
      })
    );

    // Second slice composes with first by using its computed values
    const inventorySlice = createSlice(
      (selectors) => ({ 
        stock: selectors.stock,
        // Compose with productSlice to get its computed values
        ...productSlice(({ active }) => ({ activeProducts: active }))
      }),
      ({ stock, activeProducts }, set) => ({
        // Use the composed computed value
        inStockActive: () => {
          const stockLevels = stock();
          return activeProducts().filter(p => ((stockLevels as Record<string, number>)[p.id] || 0) > 0);
        },
        updateStock: (id: string, quantity: number) => set(
          (selectors) => ({ stock: selectors.stock }),
          ({ stock }) => ({ stock: { ...stock(), [id]: quantity } })
        )
      })
    );

    // Initial state
    expect(inventorySlice().inStockActive()).toHaveLength(2); // products 1 and 3

    // Toggle product 1 to inactive
    productSlice().toggleActive('1');
    expect(inventorySlice().inStockActive()).toHaveLength(1); // only product 3

    // Update stock for product 2
    inventorySlice().updateStock('2', 10);
    expect(inventorySlice().inStockActive()).toHaveLength(1); // still only product 3 (2 is inactive)

    // Toggle product 2 to active
    productSlice().toggleActive('2');
    expect(inventorySlice().inStockActive()).toHaveLength(2); // products 2 and 3
  });

  it('should efficiently track dependencies through computed chains', () => {
    const createSlice = createStore({ a: 1, b: 2, c: 3 });

    const sliceA = createSlice(
      (selectors) => ({ a: selectors.a }),
      ({ a }) => ({
        doubled: () => a() * 2
      })
    );

    const sliceB = createSlice(
      (selectors) => ({ 
        b: selectors.b,
        ...sliceA(({ doubled }) => ({ doubled }))
      }),
      ({ b, doubled }) => ({
        // Use the composed value
        sum: () => doubled() + b()
      })
    );

    const metadataA = getSliceMetadata(sliceA);
    const metadataB = getSliceMetadata(sliceB);

    // Check dependencies
    expect(metadataA?.dependencies.has('a')).toBe(true);
    expect(metadataA?.dependencies.has('b')).toBe(false);
    expect(metadataB?.dependencies.has('b')).toBe(true);
    // Note: sliceB doesn't directly depend on 'a', but on sliceA.doubled()
  });

  it('should notify composed slices when dependencies change', () => {
    const createSlice = createStore({ 
      users: [{ id: '1', active: true }],
      scores: { '1': 100 }
    });

    const userSlice = createSlice(
      (selectors) => ({ users: selectors.users }),
      ({ users }, set) => ({
        activeUsers: () => users().filter(u => u.active),
        deactivateUser: (id: string) => set(
          (selectors) => ({ users: selectors.users }),
          ({ users }) => ({
            users: users().map(u => u.id === id ? { ...u, active: false } : u)
          })
        )
      })
    );

    const scoreSlice = createSlice(
      (selectors) => ({ 
        scores: selectors.scores,
        ...userSlice(({ activeUsers }) => ({ activeUsers }))
      }),
      ({ scores, activeUsers }) => ({
        activeUserScores: () => {
          const active = activeUsers();
          const scoreMap = scores();
          return active.map(u => ({ userId: u.id, score: (scoreMap as Record<string, number>)[u.id] || 0 }));
        }
      })
    );

    const metadata = getSliceMetadata(scoreSlice);
    const listener = vi.fn();
    metadata!.subscribe(listener);

    // Initial state
    expect(scoreSlice().activeUserScores()).toEqual([{ userId: '1', score: 100 }]);

    // Deactivate user should trigger scoreSlice listener
    userSlice().deactivateUser('1');
    expect(listener).toHaveBeenCalled();
    expect(scoreSlice().activeUserScores()).toEqual([]);
  });
});
/**
 * @fileoverview Middleware Composition Patterns
 *
 * This example demonstrates how to use the API parameter to implement
 * various middleware patterns including:
 * - Performance monitoring
 * - Caching
 * - Validation
 * - Error boundaries
 * - Undo/Redo functionality
 */

import React from 'react';
import {
  createComponent,
  createModel,
  createSlice,
  type SliceFactory,
} from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews } from '@lattice/runtime/react';

// ============================================================================
// Middleware Utilities
// ============================================================================

// Performance monitoring middleware
function withPerformanceMonitoring<M, T>(
  slice: SliceFactory<M, T>,
  name: string
): SliceFactory<M, T> {
  return (model) => {
    const startTime = performance.now();
    const result = slice(model);
    const endTime = performance.now();

    if (typeof window !== 'undefined' && (window as any).__PERF_MONITORING) {
      console.log(`[Perf] ${name} took ${(endTime - startTime).toFixed(2)}ms`);
    }

    return result;
  };
}

// Caching middleware
const cache = new Map<string, { value: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

function withCaching<M, T>(
  slice: SliceFactory<M, T>,
  getCacheKey: (model: M) => string
): SliceFactory<M, T> {
  return (model) => {
    const key = getCacheKey(model);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Cache] Hit for key: ${key}`);
      return cached.value;
    }

    const result = slice(model);
    cache.set(key, { value: result, timestamp: Date.now() });
    console.log(`[Cache] Miss for key: ${key}, caching result`);

    return result;
  };
}

// Validation middleware
function withValidation<M, T>(
  slice: SliceFactory<M, T>,
  validator: (result: T) => { valid: boolean; errors?: string[] }
): SliceFactory<M, T> {
  return (model) => {
    const result = slice(model);
    const validation = validator(result);

    if (!validation.valid) {
      console.error('[Validation] Failed:', validation.errors);
      throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
    }

    return result;
  };
}

// Error boundary middleware
function withErrorBoundary<M, T>(
  slice: SliceFactory<M, T>,
  fallback: T,
  onError?: (error: Error) => void
): SliceFactory<M, T> {
  return (model) => {
    try {
      return slice(model);
    } catch (error) {
      console.error('[ErrorBoundary] Caught error:', error);
      onError?.(error as Error);
      return fallback;
    }
  };
}

// ============================================================================
// Example Component with Middleware
// ============================================================================
interface HistoryEntry<T> {
  timestamp: number;
  state: T;
  action: string;
}

export const middlewareComponent = createComponent(() => {
  type ModelType = {
    // Domain state
    items: Array<{ id: string; name: string; price: number; tags: string[] }>;
    filters: { search: string; tags: string[]; priceRange: [number, number] };
    sortBy: 'name' | 'price' | 'newest';

    // Actions
    addItem: (item: { name: string; price: number; tags: string[] }) => void;
    removeItem: (id: string) => void;
    updateFilters: (filters: Partial<ModelType['filters']>) => void;
    setSortBy: (sortBy: ModelType['sortBy']) => void;

    // Undo/Redo state
    history: HistoryEntry<any>[];
    historyIndex: number;
    undo: () => void;
    redo: () => void;
  };

  const model = createModel<ModelType>(({ set, get }) => ({
    // Initial state
    items: [
      {
        id: '1',
        name: 'Laptop',
        price: 999,
        tags: ['electronics', 'computers'],
      },
      { id: '2', name: 'Phone', price: 699, tags: ['electronics', 'mobile'] },
      { id: '3', name: 'Desk', price: 299, tags: ['furniture', 'office'] },
    ],
    filters: { search: '', tags: [], priceRange: [0, 9999] },
    sortBy: 'name',
    history: [],
    historyIndex: -1,

    // Actions with history tracking
    addItem: (item) => {
      const newItem = {
        id: `item-${Date.now()}`,
        ...item,
      };

      const currentState = get();
      const newHistory = currentState.history.slice(
        0,
        currentState.historyIndex + 1
      );
      newHistory.push({
        timestamp: Date.now(),
        state: {
          items: currentState.items,
          filters: currentState.filters,
          sortBy: currentState.sortBy,
        },
        action: `Add item: ${item.name}`,
      });

      set({
        items: [...currentState.items, newItem],
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    removeItem: (id) => {
      const currentState = get();
      const item = currentState.items.find((i) => i.id === id);
      if (!item) return;

      const newHistory = currentState.history.slice(
        0,
        currentState.historyIndex + 1
      );
      newHistory.push({
        timestamp: Date.now(),
        state: {
          items: currentState.items,
          filters: currentState.filters,
          sortBy: currentState.sortBy,
        },
        action: `Remove item: ${item.name}`,
      });

      set({
        items: currentState.items.filter((i) => i.id !== id),
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    updateFilters: (filters) => {
      set({ filters: { ...get().filters, ...filters } });
    },

    setSortBy: (sortBy) => {
      set({ sortBy });
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex < 0) return;

      const previousState = history[historyIndex]?.state;
      if (!previousState) return;
      set({
        ...previousState,
        historyIndex: historyIndex - 1,
      });
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;

      const nextState = history[historyIndex + 1]?.state;
      if (!nextState) return;
      set({
        ...nextState,
        historyIndex: historyIndex + 1,
      });
    },
  }));

  // Basic slices
  const itemsSlice = createSlice(model, (m) => m.items);
  const filtersSlice = createSlice(model, (m) => m.filters);

  // Filtered items with multiple middleware layers
  const filteredItemsSlice = withErrorBoundary(
    withPerformanceMonitoring(
      withCaching(
        createSlice(model, (m) => {
          let items = m.items;

          // Apply search filter
          if (m.filters.search) {
            items = items.filter((item) =>
              item.name.toLowerCase().includes(m.filters.search.toLowerCase())
            );
          }

          // Apply tag filters
          if (m.filters.tags.length > 0) {
            items = items.filter((item) =>
              m.filters.tags.some((tag) => item.tags.includes(tag))
            );
          }

          // Apply price range filter
          const [minPrice, maxPrice] = m.filters.priceRange;
          items = items.filter(
            (item) => item.price >= minPrice && item.price <= maxPrice
          );

          // Apply sorting
          items = [...items].sort((a, b) => {
            switch (m.sortBy) {
              case 'name':
                return a.name.localeCompare(b.name);
              case 'price':
                return a.price - b.price;
              case 'newest':
                return b.id.localeCompare(a.id);
              default:
                return 0;
            }
          });

          return items;
        }),
        (model) =>
          `${model.filters.search}-${model.filters.tags.join(',')}-${model.filters.priceRange.join('-')}-${model.sortBy}`
      ),
      'filteredItems'
    ),
    [], // Fallback value
    (error) => console.error('Error in filteredItems:', error)
  );

  // Stats with validation
  const statsSlice = withValidation(
    createSlice(model, (m) => {
      const filteredItems = filteredItemsSlice(m);

      return {
        totalItems: m.items.length,
        filteredItems: filteredItems.length,
        totalValue: filteredItems.reduce((sum, item) => sum + item.price, 0),
        averagePrice:
          filteredItems.length > 0
            ? filteredItems.reduce((sum, item) => sum + item.price, 0) /
              filteredItems.length
            : 0,
        tags: Array.from(new Set(m.items.flatMap((item) => item.tags))),
      };
    }),
    (stats) => ({
      valid: stats.totalItems >= 0 && stats.averagePrice >= 0,
      errors: [
        stats.totalItems < 0 ? 'Total items cannot be negative' : null,
        stats.averagePrice < 0 ? 'Average price cannot be negative' : null,
      ].filter(Boolean) as string[],
    })
  );

  // Actions with middleware
  const actions = createSlice(model, (m) => ({
    addItem: (item: Parameters<typeof m.addItem>[0]) => {
      // Validate item before adding
      if (!item.name || item.price < 0) {
        console.error('[Actions] Invalid item:', item);
        return;
      }

      console.log('[Actions] Adding item:', item);
      m.addItem(item);

      // Clear cache after mutation
      cache.clear();
    },

    removeItem: (id: string) => {
      console.log('[Actions] Removing item:', id);
      m.removeItem(id);

      // Clear cache after mutation
      cache.clear();
    },

    updateFilters: m.updateFilters,
    setSortBy: m.setSortBy,
    undo: m.undo,
    redo: m.redo,
  }));

  // History view
  const historyView = createSlice(model, (m) => ({
    entries: m.history,
    currentIndex: m.historyIndex,
    canUndo: m.historyIndex >= 0,
    canRedo: m.historyIndex < m.history.length - 1,
  }));

  return {
    model,
    actions,
    views: {
      items: itemsSlice,
      filteredItems: filteredItemsSlice,
      filters: filtersSlice,
      stats: statsSlice,
      history: historyView,
    },
  };
});

// ============================================================================
// Create Store
// ============================================================================
const middlewareStore = createZustandAdapter(middlewareComponent);

// ============================================================================
// React Components
// ============================================================================
declare global {
  interface Window {
    __PERF_MONITORING?: boolean;
  }
}

function ItemList() {
  const items = useViews(middlewareStore, (views) => views.filteredItems());

  return (
    <div>
      <h3>Items ({items.length})</h3>
      {items.length === 0 ? (
        <p>No items match your filters</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              {item.name} - ${item.price}
              <span
                style={{ marginLeft: '10px', fontSize: '0.8em', color: '#666' }}
              >
                {item.tags.join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filters() {
  const filters = useViews(middlewareStore, (views) => views.filters());
  const actions = middlewareStore.actions;

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Filters</h3>

      <div>
        <input
          type="text"
          placeholder="Search items..."
          value={filters.search}
          onChange={(e) => actions.updateFilters({ search: e.target.value })}
        />
      </div>

      <div style={{ marginTop: '10px' }}>
        <label>
          Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}
          <input
            type="range"
            min="0"
            max="1000"
            value={filters.priceRange[0]}
            onChange={(e) =>
              actions.updateFilters({
                priceRange: [parseInt(e.target.value), filters.priceRange[1]],
              })
            }
          />
          <input
            type="range"
            min="0"
            max="1000"
            value={filters.priceRange[1]}
            onChange={(e) =>
              actions.updateFilters({
                priceRange: [filters.priceRange[0], parseInt(e.target.value)],
              })
            }
          />
        </label>
      </div>

      <div style={{ marginTop: '10px' }}>
        <label>
          Sort by:
          <select onChange={(e) => actions.setSortBy(e.target.value as any)}>
            <option value="name">Name</option>
            <option value="price">Price</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function Stats() {
  const stats = useViews(middlewareStore, (views) => views.stats());

  return (
    <div
      style={{ background: '#f0f0f0', padding: '10px', marginBottom: '20px' }}
    >
      <h3>Statistics</h3>
      <p>Total Items: {stats.totalItems}</p>
      <p>Filtered Items: {stats.filteredItems}</p>
      <p>Total Value: ${stats.totalValue.toFixed(2)}</p>
      <p>Average Price: ${stats.averagePrice.toFixed(2)}</p>
      <p>Available Tags: {stats.tags.join(', ')}</p>
    </div>
  );
}

function History() {
  const history = useViews(middlewareStore, (views) => views.history());
  const actions = middlewareStore.actions;

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>History</h3>
      <div>
        <button onClick={() => actions.undo()} disabled={!history.canUndo}>
          Undo
        </button>
        <button onClick={() => actions.redo()} disabled={!history.canRedo}>
          Redo
        </button>
      </div>

      {history.entries.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
          <h4>Actions:</h4>
          {history.entries.map((entry, index) => (
            <div
              key={index}
              style={{
                opacity: index <= history.currentIndex ? 1 : 0.5,
                textDecoration:
                  index > history.currentIndex ? 'line-through' : 'none',
              }}
            >
              {new Date(entry.timestamp).toLocaleTimeString()}: {entry.action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MiddlewareCompositionExample() {
  const actions = middlewareStore.actions;
  const [perfMonitoring, setPerfMonitoring] = React.useState(false);

  React.useEffect(() => {
    window.__PERF_MONITORING = perfMonitoring;
  }, [perfMonitoring]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Middleware Composition Example</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={perfMonitoring}
            onChange={(e) => setPerfMonitoring(e.target.checked)}
          />
          Enable Performance Monitoring
        </label>
      </div>

      <Stats />
      <Filters />

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() =>
            actions.addItem({
              name: `New Item ${Date.now()}`,
              price: Math.floor(Math.random() * 500) + 100,
              tags: ['new', Math.random() > 0.5 ? 'electronics' : 'furniture'],
            })
          }
        >
          Add Random Item
        </button>
      </div>

      <ItemList />
      <History />

      <div
        style={{ marginTop: '40px', padding: '10px', background: '#e0e0e0' }}
      >
        <h3>Middleware Features Demonstrated:</h3>
        <ul>
          <li>Performance Monitoring - Toggle to see execution times</li>
          <li>Caching - Filters are cached for 5 seconds</li>
          <li>Validation - Stats are validated before returning</li>
          <li>Error Boundaries - Errors in filtering won't crash the app</li>
          <li>Undo/Redo - Full history tracking with time travel</li>
        </ul>
      </div>
    </div>
  );
}

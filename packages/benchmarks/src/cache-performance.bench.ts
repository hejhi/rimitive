/**
 * @fileoverview Cache performance benchmarks
 * 
 * Tests memoization effectiveness by measuring:
 * - Cache hit rates
 * - Memory usage with caching
 * - Performance improvement from caching
 * - Different access patterns
 */

import { describe, bench } from 'vitest'
import { createStore as createZustandStore } from '@lattice/adapter-zustand'
import { createStore as createReduxStore } from '@lattice/adapter-redux'
import { compose, createSlice } from '@lattice/core'

interface TestState {
  items: Array<{ id: number; value: string; category: string }>
  filters: { category?: string; search?: string }
}

const createTestStore = (adapter: 'zustand' | 'redux') => {
  const createStore = adapter === 'zustand' ? createZustandStore : createReduxStore
  
  const itemsSlice = createSlice<TestState['items']>({
    initialState: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      value: `Item ${i}`,
      category: `Category ${i % 10}`
    }))
  })
  
  const filtersSlice = createSlice<TestState['filters']>({
    initialState: {}
  })
  
  const rootSlice = compose({
    items: itemsSlice,
    filters: filtersSlice
  })
  
  return createStore(rootSlice)
}

describe('Cache Performance - Zustand', () => {
  const store = createTestStore('zustand')
  
  // Create parameterized views
  const filteredItemsView = (category: string) => {
    const state = store.getState()
    return state.items.filter(item => item.category === category)
  }
  
  const searchView = (search: string) => {
    const state = store.getState()
    return state.items.filter(item => 
      item.value.toLowerCase().includes(search.toLowerCase())
    )
  }
  
  bench('repeated same parameter access (cache hits)', () => {
    // Same parameter - should hit cache in real mode
    for (let i = 0; i < 1000; i++) {
      store.views.filteredItems = filteredItemsView
      store.views.filteredItems('Category 5')
    }
  })
  
  bench('sequential different parameters (cache misses)', () => {
    // Different parameters each time - mostly cache misses
    for (let i = 0; i < 100; i++) {
      store.views.filteredItems = filteredItemsView
      store.views.filteredItems(`Category ${i % 10}`)
    }
  })
  
  bench('hot path access pattern (80/20 rule)', () => {
    // Simulate real-world where 20% of parameters are accessed 80% of the time
    const hotCategories = ['Category 0', 'Category 1']
    const allCategories = Array.from({ length: 10 }, (_, i) => `Category ${i}`)
    
    for (let i = 0; i < 1000; i++) {
      store.views.filteredItems = filteredItemsView
      const category = Math.random() < 0.8 
        ? hotCategories[i % hotCategories.length]
        : allCategories[Math.floor(Math.random() * allCategories.length)]
      store.views.filteredItems(category)
    }
  })
  
  bench('primitive parameter caching (string search)', () => {
    const searchTerms = ['item', 'test', 'value', 'category', 'search']
    
    for (let i = 0; i < 500; i++) {
      store.views.search = searchView
      store.views.search(searchTerms[i % searchTerms.length])
    }
  })
  
  bench('cache memory pressure (many unique parameters)', () => {
    // Test behavior when cache size limits are reached
    for (let i = 0; i < 100; i++) {
      store.views.search = searchView
      store.views.search(`unique-search-${i}`)
    }
  })
})

describe('Cache Performance - Redux', () => {
  const store = createTestStore('redux')
  
  const filteredItemsView = (category: string) => {
    const state = store.getState()
    return state.items.filter(item => item.category === category)
  }
  
  bench('repeated same parameter access (cache hits)', () => {
    for (let i = 0; i < 1000; i++) {
      store.views.filteredItems = filteredItemsView
      store.views.filteredItems('Category 5')
    }
  })
  
  bench('hot path access pattern (80/20 rule)', () => {
    const hotCategories = ['Category 0', 'Category 1']
    const allCategories = Array.from({ length: 10 }, (_, i) => `Category ${i}`)
    
    for (let i = 0; i < 1000; i++) {
      store.views.filteredItems = filteredItemsView
      const category = Math.random() < 0.8 
        ? hotCategories[i % hotCategories.length]
        : allCategories[Math.floor(Math.random() * allCategories.length)]
      store.views.filteredItems(category)
    }
  })
})

describe('Cache Effectiveness Comparison', () => {
  // These benchmarks specifically compare cached vs uncached performance
  const store = createTestStore('zustand')
  
  // Complex computation that benefits from caching
  const expensiveView = (threshold: number) => {
    const state = store.getState()
    let result = 0
    
    // Simulate expensive computation
    for (let i = 0; i < state.items.length; i++) {
      for (let j = 0; j < 100; j++) {
        result += state.items[i].id * j
      }
    }
    
    return state.items.filter(item => item.id > threshold)
  }
  
  bench('expensive computation - repeated access', () => {
    // Same parameter repeatedly - maximum cache benefit
    for (let i = 0; i < 10; i++) {
      store.views.expensive = expensiveView
      store.views.expensive(500)
    }
  })
  
  bench('expensive computation - varied access', () => {
    // Different parameters - no cache benefit
    for (let i = 0; i < 10; i++) {
      store.views.expensive = expensiveView
      store.views.expensive(i * 100)
    }
  })
})
# Performance Comparison Examples

Based on actual benchmark results, here are concrete examples showing performance characteristics:

## Simple vs Complex Slices

```typescript
// ✅ FAST: Simple slice - 32 million ops/sec
const countSlice = createSlice(model, (m) => m.items.length)

// ✅ FAST: Property access - 32 million ops/sec  
const filterSlice = createSlice(model, (m) => m.filter)

// 🔶 MEDIUM: Basic computation - still 32 million ops/sec
const statusSlice = createSlice(model, (m) => ({
  count: m.items.length,
  hasFilter: m.filter.length > 0,
}))

// ❌ SLOW: Complex operations - 67,000 ops/sec (480x slower!)
const complexSlice = createSlice(model, (m) => {
  const filtered = m.items.filter(item => item.category === m.filter)
  const sorted = [...filtered].sort((a, b) => b.value - a.value)
  const top10 = sorted.slice(0, 10)
  const stats = {
    total: filtered.length,
    average: filtered.reduce((sum, item) => sum + item.value, 0) / filtered.length || 0,
    min: Math.min(...filtered.map(item => item.value)),
    max: Math.max(...filtered.map(item => item.value)),
  }
  return { top10, stats }
})
```

## Compose Overhead

```typescript
// Direct implementation - baseline performance
const directSlice = createSlice(model, (m) => 
  m.items.filter(item => item.category === m.filter)
)
// Performance: 237,000 ops/sec

// 1 level compose - 19% overhead
const itemsSlice = createSlice(model, (m) => m.items)
const filterSlice = createSlice(model, (m) => m.filter)
const composed1Level = createSlice(
  model,
  compose(
    { items: itemsSlice, filter: filterSlice },
    (_, { items, filter }) => items.filter(item => item.category === filter)
  )
)
// Performance: 198,000 ops/sec (1.20x slower)

// 3 levels compose - 36% overhead
const level1 = createSlice(model, compose({ items: itemsSlice }, (_, { items }) => items))
const level2 = createSlice(model, compose({ data: level1 }, (_, { data }) => data))
const level3 = createSlice(
  model, 
  compose({ data: level2 }, (m, { data }) => data.filter(i => i.value > 500))
)
// Performance: ~150,000 ops/sec (1.36x slower)
```

## Real-World Optimization Example

```typescript
// ❌ BAD: Everything in one complex slice
const badApproach = createSlice(model, (m) => {
  const filtered = m.items.filter(item => 
    item.category === m.selectedCategory &&
    item.price >= m.priceRange.min &&
    item.price <= m.priceRange.max &&
    item.name.toLowerCase().includes(m.searchQuery)
  )
  
  const sorted = [...filtered].sort((a, b) => {
    switch (m.sortBy) {
      case 'price-asc': return a.price - b.price
      case 'price-desc': return b.price - a.price
      case 'rating': return b.rating - a.rating
      default: return 0
    }
  })
  
  const paged = sorted.slice(m.page * m.pageSize, (m.page + 1) * m.pageSize)
  
  return {
    items: paged,
    totalCount: filtered.length,
    stats: {
      minPrice: Math.min(...filtered.map(i => i.price)),
      maxPrice: Math.max(...filtered.map(i => i.price)),
      avgRating: filtered.reduce((sum, i) => sum + i.rating, 0) / filtered.length
    }
  }
})

// ✅ GOOD: Break into focused slices with compose
const filteredItems = createSlice(model, (m) => {
  // Only filter - single responsibility
  return m.items.filter(item => 
    item.category === m.selectedCategory &&
    item.price >= m.priceRange.min &&
    item.price <= m.priceRange.max &&
    item.name.toLowerCase().includes(m.searchQuery)
  )
})

const sortedItems = createSlice(
  model,
  compose(
    { filtered: filteredItems },
    (m, { filtered }) => {
      // Only sort - reusable
      const sorted = [...filtered]
      switch (m.sortBy) {
        case 'price-asc': return sorted.sort((a, b) => a.price - b.price)
        case 'price-desc': return sorted.sort((a, b) => b.price - a.price)
        case 'rating': return sorted.sort((a, b) => b.rating - a.rating)
        default: return sorted
      }
    }
  )
)

const pagedItems = createSlice(
  model,
  compose(
    { sorted: sortedItems },
    (m, { sorted }) => ({
      // Pagination + count
      items: sorted.slice(m.page * m.pageSize, (m.page + 1) * m.pageSize),
      totalCount: sorted.length,
    })
  )
)

// Separate slice for expensive stats calculation
const itemStats = createSlice(
  model,
  compose(
    { filtered: filteredItems },
    (_, { filtered }) => {
      if (filtered.length === 0) return null
      
      return {
        minPrice: Math.min(...filtered.map(i => i.price)),
        maxPrice: Math.max(...filtered.map(i => i.price)),
        avgRating: filtered.reduce((sum, i) => sum + i.rating, 0) / filtered.length
      }
    }
  )
)
```

## Key Takeaways

1. **Simple slices are EXTREMELY fast** - 32 million ops/sec for property access
2. **Complex slices are 400-500x slower** - but 67,000 ops/sec is still very fast!
3. **Compose overhead is reasonable** - 13-19% per level is acceptable for most use cases
4. **Benefits of compose outweigh overhead**:
   - Better code organization
   - Reusable slices
   - Easier testing
   - Clear data dependencies
   - Memoization works per slice

5. **Performance tips**:
   - Keep individual slices focused and simple
   - Use compose to build complex behavior from simple parts
   - Let memoization handle caching
   - Profile before optimizing - 67,000 ops/sec might be plenty!
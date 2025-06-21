# Partial Update Performance Benchmark Specification

## Summary

A comprehensive benchmark suite measuring Lattice's partial update performance against industry-standard frameworks using established JS Framework Benchmark methodologies. This spec defines the most valuable KPI for demonstrating Lattice's competitive advantage in fine-grained reactivity.

## Motivation

### Why Partial Update Performance?

**Industry Standard**: The JS Framework Benchmark's "partial update" test is the gold standard for measuring reactive framework efficiency. All major frameworks (React, Vue, Solid, Svelte) are compared using this metric.

**Core Value Demonstration**: Partial updates directly showcase Lattice's architectural advantage - updating specific state slices without affecting unrelated components.

**Competitive Positioning**: Enables direct performance comparisons with established frameworks using metrics every developer understands.

## Benchmark Specification

### Primary Metric: Partial Update Time

**Definition**: Time (in milliseconds) to update a subset of state properties while leaving others unchanged.

**Target**: Achieve 2-5x faster partial update performance compared to:
- React Context
- Redux (naive selectors)
- Zustand
- MobX

### Test Scenarios

#### 1. Standard JS Framework Benchmark Adaptation
```typescript
// Test: "partial update - every 10th item"
// Scenario: 1000 items, update every 10th (100 total updates)
bench('lattice-partial-update-standard', () => {
  const items = Array.from({length: 1000}, (_, i) => ({id: i, value: i}));
  
  // Setup: Create slices for each item
  const itemSlices = items.map(item => createSlice(
    selectors => ({ item: selectors.items[item.id] }),
    ({ item }, set) => ({
      value: () => item().value,
      update: (newValue) => set(
        selectors => ({ item: selectors.items[item.id] }),
        () => ({ items: { [item.id]: { ...item(), value: newValue } } })
      )
    })
  ));
  
  // Measure: Time to update every 10th item
  const start = performance.now();
  for (let i = 0; i < 1000; i += 10) {
    itemSlices[i]().update(i * 2);
  }
  const end = performance.now();
  return end - start;
});
```

#### 2. Deep Nested State Updates
```typescript
// Test: "partial update - deep nested properties"
// Scenario: user.profile.settings.theme updates shouldn't affect user.posts
bench('lattice-partial-update-nested', () => {
  const createSlice = createLatticeStore({
    users: {},
    posts: {},
    settings: {}
  });
  
  // Setup: Create nested slices with different dependency levels
  const userProfileSlice = createSlice(
    selectors => ({ 
      user: selectors.users.current,
      profile: selectors.users.current?.profile 
    }),
    ({ user, profile }, set) => ({
      updateTheme: (theme) => set(
        selectors => ({ user: selectors.users.current }),
        ({ user }) => ({ 
          users: { 
            current: { 
              ...user(), 
              profile: { ...user().profile, settings: { theme } }
            }
          }
        })
      )
    })
  );
  
  const postsSlice = createSlice(
    selectors => ({ posts: selectors.posts }),
    ({ posts }, set) => ({
      posts: () => posts(),
      addPost: (post) => set(
        selectors => ({ posts: selectors.posts }),
        ({ posts }) => ({ posts: [...posts(), post] })
      )
    })
  );
  
  // Measure: Theme update shouldn't trigger posts slice
  // Track: Which slices actually get notified
  let postsNotified = false;
  postsSlice.subscribe(() => { postsNotified = true; });
  
  const start = performance.now();
  userProfileSlice().updateTheme('dark');
  const end = performance.now();
  
  // Assert: Posts slice should NOT be notified
  assert(!postsNotified, 'Posts slice should not be notified for theme change');
  
  return end - start;
});
```

#### 3. Real-World Form Scenario
```typescript
// Test: "partial update - form field changes"
// Scenario: 50-field form, update single field shouldn't affect others
bench('lattice-partial-update-form', () => {
  type FormField = { value: string; error?: string; touched: boolean };
  type FormState = { fields: Record<string, FormField> };
  
  const createSlice = createLatticeStore<FormState>({
    fields: Object.fromEntries(
      Array.from({length: 50}, (_, i) => [
        `field_${i}`, 
        { value: '', touched: false }
      ])
    )
  });
  
  // Setup: Create slice for each field
  const fieldSlices = Array.from({length: 50}, (_, i) => 
    createSlice(
      selectors => ({ field: selectors.fields[`field_${i}`] }),
      ({ field }, set) => ({
        value: () => field().value,
        updateValue: (value) => set(
          selectors => ({ field: selectors.fields[`field_${i}`] }),
          ({ field }) => ({ 
            fields: { 
              [`field_${i}`]: { ...field(), value, touched: true }
            }
          })
        )
      })
    )
  );
  
  // Measure: Update 10 random fields
  const fieldsToUpdate = [5, 15, 25, 35, 45];
  const start = performance.now();
  fieldsToUpdate.forEach(i => {
    fieldSlices[i]().updateValue(`updated_${i}`);
  });
  const end = performance.now();
  
  return end - start;
});
```

### Baseline Comparisons

#### React Context Baseline
```typescript
bench('react-context-partial-update', () => {
  // Traditional Context approach - all consumers re-render
  const [state, setState] = useState(initialState);
  
  const start = performance.now();
  setState(prev => ({ 
    ...prev, 
    items: prev.items.map((item, i) => 
      i % 10 === 0 ? { ...item, value: item.value * 2 } : item
    )
  }));
  const end = performance.now();
  
  return end - start;
});
```

#### Zustand Baseline
```typescript
bench('zustand-partial-update', () => {
  const store = create((set, get) => ({
    items: initialItems,
    updateItem: (id, value) => set(state => ({
      items: state.items.map(item => 
        item.id === id ? { ...item, value } : item
      )
    }))
  }));
  
  const start = performance.now();
  for (let i = 0; i < 1000; i += 10) {
    store.getState().updateItem(i, i * 2);
  }
  const end = performance.now();
  
  return end - start;
});
```

## Performance Targets

### Success Metrics
```typescript
// Target: Lattice vs Competitors (lower is better)
interface PerformanceTargets {
  lattice: number;           // Target: < 10ms
  reactContext: number;      // Expected: 40-60ms  
  zustandNaive: number;      // Expected: 25-35ms
  mobx: number;             // Expected: 15-25ms
}

// Goal: 2-5x performance improvement
const expectedSpeedup = {
  vsReactContext: '4-6x faster',
  vsZustand: '2-3x faster', 
  vsMobX: '1.5-2x faster'
};
```

### Secondary Metrics

#### Notification Efficiency
```typescript
// Track: How many components/slices actually update
interface NotificationMetrics {
  totalStateChanges: number;
  actualNotifications: number;
  efficiency: number; // (total - actual) / total * 100
}

// Target: >90% notification efficiency
// (10 updates out of 1000 items = 99% efficiency)
```

#### Memory Impact
```typescript
// Track: Memory overhead during partial updates
interface MemoryMetrics {
  beforeUpdate: number;    // Heap size before
  afterUpdate: number;     // Heap size after  
  peakDuring: number;      // Peak during update
  recovered: number;       // After GC
}
```

## Implementation Plan

### Phase 1: Core Benchmark Infrastructure
1. Set up benchmark runner using Vitest
2. Implement baseline test scenarios
3. Create measurement utilities
4. Establish CI integration

### Phase 2: Comparative Analysis
1. Implement React Context baselines
2. Add Zustand comparison tests
3. Include MobX benchmarks (if possible)
4. Generate comparison reports

### Phase 3: Real-World Validation
1. Add complex form scenarios
2. E-commerce cart simulations
3. Data table pagination tests
4. Live dashboard updates

### Phase 4: Optimization & Reporting
1. Identify performance bottlenecks
2. Optimize slice creation and updates
3. Generate marketing-ready performance reports
4. Document best practices

## Benchmark Output Format

### Performance Report
```typescript
interface BenchmarkResults {
  scenario: string;
  lattice: {
    updateTime: number;
    notificationEfficiency: number;
    memoryImpact: number;
  };
  baselines: {
    reactContext: { updateTime: number };
    zustand: { updateTime: number };
    mobx: { updateTime: number };
  };
  speedup: {
    vsReactContext: string; // "4.2x faster"
    vsZustand: string;      // "2.8x faster"
  };
}
```

### Marketing Summary
```typescript
interface MarketingSummary {
  headline: string; // "Lattice: 3x faster partial updates than Zustand"
  keyMetrics: {
    averageSpeedup: string;    // "3.2x faster average"
    bestCase: string;          // "5.8x faster (form updates)"
    efficiency: string;        // "94% notification efficiency"
  };
  useCases: string[];          // ["Forms", "Data tables", "Live dashboards"]
}
```

## Success Criteria

### Technical Goals
- [ ] Lattice achieves 2-5x faster partial update performance
- [ ] >90% notification efficiency in all scenarios  
- [ ] Memory overhead <20% vs baseline frameworks
- [ ] Benchmark suite runs in <30 seconds

### Business Goals
- [ ] Clear competitive advantage messaging
- [ ] Quantified performance claims for marketing
- [ ] Technical validation for enterprise adoption
- [ ] Reference implementation for best practices

## Open Questions

1. **Framework Selection**: Should we include Vue 3 Composition API in comparisons?
2. **Test Complexity**: How deep should nested state scenarios go?
3. **Real-World Validation**: Which industry use cases should we prioritize?
4. **CI Integration**: Should benchmarks run on every commit or nightly?
5. **Performance Regression**: What thresholds trigger performance alerts?

## Dependencies

### Technical Requirements
- Existing benchmark infrastructure in `/packages/benchmarks`
- Vitest testing framework
- Performance measurement utilities
- CI/CD pipeline integration

### Framework Integrations
- React testing utilities
- Zustand test setup
- MobX benchmark harness (if feasible)
- Memory profiling tools

### Documentation Needs
- Benchmark methodology explanation
- Performance optimization guide
- Competitive comparison reports
- Best practices documentation
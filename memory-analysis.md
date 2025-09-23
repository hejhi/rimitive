# Memory Usage Analysis: Lattice vs Preact/Alien Signals

## Problem Statement
The `computed-diamond-simple` benchmark shows Lattice using ~3.82 MB while Preact and Alien signals use <1 KB (~744 bytes).

## Key Architectural Differences

### 1. Dependency Edge Allocation Pattern

#### Preact/Alien Signals (Memory-Efficient)
- **Single Node object** per dependency relationship
- The `Node` object serves as BOTH:
  - The edge in the dependency graph
  - The container for all edge metadata
- Preact's Node structure (~40-48 bytes per edge):
  ```typescript
  type Node = {
    _source: Signal;           // 8 bytes (reference)
    _prevSource?: Node;        // 8 bytes
    _nextSource?: Node;        // 8 bytes
    _target: Computed;         // 8 bytes
    _prevTarget?: Node;        // 8 bytes
    _nextTarget?: Node;        // 8 bytes
    _version: number;          // 8 bytes (SMI or heap number)
    _rollbackNode?: Node;      // 8 bytes
  }
  ```

#### Lattice (Memory-Heavy)
- **Multiple objects per node**:
  1. SignalNode object
  2. Signal function closure
  3. Peek function
  4. Dependency objects for each edge
  5. Additional helper closures and context objects

- Lattice's Dependency structure (~64-72 bytes per edge):
  ```typescript
  interface Dependency {
    producer: FromNode;         // 8 bytes
    consumer: ToNode;          // 8 bytes
    prevConsumer?: Dependency; // 8 bytes
    nextConsumer?: Dependency; // 8 bytes
    prevDependency?: Dependency; // 8 bytes
    nextDependency?: Dependency; // 8 bytes
    // Plus V8 object overhead (~16-24 bytes)
  }
  ```

### 2. Factory Pattern Overhead

#### Lattice Issues:
1. **Factory Initialization**: `createApi()` creates multiple factory instances and helper objects:
   - `createGraphTraversal()` - creates closure with internal state
   - `createGraphEdges()` - creates 3 function closures (trackDependency, detachAll, track)
   - `createBaseContext()` - creates context object
   - `createPullPropagator()` - creates closures for pull updates
   - `createSignalAPI()` - creates the composition layer

2. **Per-Signal Overhead**:
   - Each signal creates a new function object (`signal`)
   - Each signal gets a separate `peek` method
   - SignalNode object with all properties

3. **Per-Computed Overhead**:
   - ComputedNode object
   - `computed` function closure
   - `peek` method closure
   - Captures references to `ctx`, `trackDependency`, `pullUpdates`

### 3. Memory Retention Issues

#### Potential Leaks in Lattice:

1. **Context Capture**: Every signal/computed captures the entire opts object:
   ```typescript
   function createSignal<T>(initialValue: T): SignalFunction<T> {
     const node: SignalNode<T> = { /* ... */ };

     function signal(value?: T): T | void {
       // This closure captures ctx, trackDependency, propagate
       // These are shared but the closure itself is unique per signal
     }
     return signal;
   }
   ```

2. **Factory State**: The `createApi()` call creates persistent state that's held for all signals:
   - Graph traversal state
   - Graph edges helpers
   - Context object
   - Pull propagator state

3. **Benchmark Loop Amplification**: The benchmark runs 100,000 iterations:
   ```typescript
   for (let i = 0; i < ITERATIONS; i++) {
     source(i);
     void bottom();
   }
   ```
   - If any temporary objects are retained per iteration, it compounds quickly
   - Lattice may be creating temporary objects during propagation that aren't immediately GC'd

## Specific Problem Areas

### 1. Helper Factory Pattern
Location: `/packages/signals/src/helpers/graph-edges.ts`
- Creates 3 separate function closures per API instance
- Each closure is ~1-2 KB in memory

### 2. Signal/Computed Function Closures
Location: `/packages/signals/src/signal.ts`, `/packages/signals/src/computed.ts`
- Each signal/computed creates unique function objects
- These capture the opts object (ctx, trackDependency, propagate)

### 3. API Composition Layer
Location: `/packages/signals/src/api.ts`
- Additional wrapping layer adds overhead
- Creates proxy objects and additional closures

### 4. Dependency Object Size
Location: `/packages/signals/src/types.ts`
- Dependency objects are larger than Preact's Node objects
- Two separate linked lists vs. single dual-purpose list

## Recommendations

### Immediate Fixes:
1. **Singleton Factory Instances**: Create helpers once globally, not per API instance
2. **Prototype Methods**: Use prototypes instead of closure methods for signal.peek()
3. **Reduce Dependency Object Size**: Merge the two linked list structures into one

### Architectural Changes:
1. **Remove Factory Pattern**: Use direct constructors like Preact/Alien
2. **Single Node Type**: Merge Dependency edges into a single Node type
3. **Global Context**: Use module-level context instead of instance-level
4. **Inline Helper Functions**: Remove helper factory closures

### Memory Profiling Needed:
- Use Chrome DevTools heap snapshots during benchmark
- Identify retained objects between iterations
- Check for circular references preventing GC
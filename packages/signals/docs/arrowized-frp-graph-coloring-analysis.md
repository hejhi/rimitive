# Arrowized FRP with Hybrid Push/Pull and Graph Coloring for @lattice/signals

## Executive Summary

This analysis explores the potential integration of arrowized Functional Reactive Programming (FRP) with graph coloring optimizations into @lattice/signals' existing push-pull reactive system. While @lattice/signals already implements an efficient node-based reactive algorithm with version tracking and linked-list graphs, arrowized FRP could provide superior composability, type safety, and parallel execution opportunities. However, the analysis reveals that while intellectually compelling, the practical benefits may not justify the implementation complexity for most use cases.

## 1. Arrowized FRP Fundamentals

### 1.1 What Are FRP Arrows?

Arrows in FRP represent **signal functions** - first-class transformations between time-varying values. Unlike the current node-based approach where computations are embedded in graph nodes, arrows are composable building blocks that can be combined using arrow combinators.

```typescript
// Current node-based approach in @lattice/signals
const doubled = computed(() => source() * 2);
const quadrupled = computed(() => doubled() * 2);

// Arrowized approach
const double = arr((x: number) => x * 2);
const quadruple = double >>> double;  // Arrow composition
const result = runSignal(source, quadruple);
```

### 1.2 Key Concepts from Arrow Theory

**Arrow Laws (Hughes, 2000):**
- **Identity**: `arr id >>> f = f = f >>> arr id`
- **Composition**: `(f >>> g) >>> h = f >>> (g >>> h)`
- **First**: Allows partial application to product types
- **Distributivity**: `first (arr f) = arr (f × id)`

**Signal Functions (Yampa/Netwire):**
```haskell
-- Yampa's core type
type SF a b = Signal a -> Signal b

-- Key combinators
arr :: (a -> b) -> SF a b                    -- Lift pure function
(>>>) :: SF a b -> SF b c -> SF a c          -- Sequential composition
(&&&) :: SF a b -> SF a c -> SF a (b, c)     -- Parallel composition
(|||) :: SF a b -> SF c d -> SF (Either a c) (Either b d)  -- Choice
loop :: SF (a, c) (b, c) -> SF a b           -- Feedback
```

### 1.3 Existing Implementations

**Yampa (Haskell):**
- Continuous-time FRP with arrows
- Used in robotics and games
- Pull-based with sampling

**Netwire (Haskell):**
- Discrete/continuous hybrid
- Inhibition for conditional flows
- Wire abstraction over arrows

**Dunai (Haskell):**
- Monadic stream functions
- Generalizes Yampa's approach
- Better composability with effects

## 2. Arrowized FRP in Push/Pull Hybrid Context

### 2.1 Architectural Integration

The current @lattice/signals uses a node-centric graph where each node contains both data and computation. An arrowized approach would separate these concerns:

```typescript
// Current architecture: Nodes contain computation
interface ComputedNode<T> {
  compute: () => T;
  value: T;
  dependencies: Dependency;
  // ... graph edges
}

// Arrowized architecture: Arrows as separate entities
interface ArrowNode<A, B> {
  arrow: SignalArrow<A, B>;
  inputPort: Port<A>;
  outputPort: Port<B>;
  color?: NodeColor;  // For parallel execution
}

interface SignalArrow<A, B> {
  // Core arrow operations
  compose<C>(g: SignalArrow<B, C>): SignalArrow<A, C>;
  parallel<C, D>(g: SignalArrow<C, D>): SignalArrow<[A, C], [B, D]>;

  // Push/Pull hybrid execution
  pushInvalidate(change: Change<A>): void;
  pullCompute(input: A): B;

  // Metadata for optimization
  readonly isPure: boolean;
  readonly canParallelize: boolean;
  readonly estimatedCost: number;
}
```

### 2.2 Push/Pull Execution Model

The hybrid model would work at the arrow level:

```typescript
class HybridSignalArrow<A, B> implements SignalArrow<A, B> {
  private cache?: { input: A; output: B; version: number };
  private downstream: Set<SignalArrow<B, any>> = new Set();

  constructor(
    private computation: (a: A) => B,
    private options: ArrowOptions = {}
  ) {}

  // PUSH: Propagate invalidation
  pushInvalidate(change: Change<A>): void {
    if (this.cache && !this.shouldInvalidate(change)) {
      return; // Early exit if change doesn't affect us
    }

    this.cache = undefined; // Invalidate cache

    // Propagate to downstream arrows
    for (const arrow of this.downstream) {
      arrow.pushInvalidate({
        type: 'downstream',
        source: this
      });
    }
  }

  // PULL: Compute on demand
  pullCompute(input: A): B {
    if (this.cache?.input === input) {
      return this.cache.output; // Cache hit
    }

    const output = this.computation(input);
    this.cache = { input, output, version: globalVersion++ };
    return output;
  }

  // Arrow composition
  compose<C>(g: SignalArrow<B, C>): SignalArrow<A, C> {
    return new ComposedArrow(this, g);
  }
}
```

### 2.3 Concrete Example: Current vs Arrowized

```typescript
// CURRENT IMPLEMENTATION
const createDiamondGraph = () => {
  const source = signal(0);
  const left = computed(() => source() * 2);
  const right = computed(() => source() + 10);
  const bottom = computed(() => left() + right());
  return { source, bottom };
};

// ARROWIZED IMPLEMENTATION
const createDiamondArrow = () => {
  // Define arrow transformations
  const multiply2 = arr<number, number>(x => x * 2);
  const add10 = arr<number, number>(x => x + 10);
  const sum = arr<[number, number], number>(([a, b]) => a + b);

  // Compose the diamond pattern
  const diamond = (multiply2 &&& add10) >>> sum;

  // Apply to signal
  const source = signal(0);
  return applyArrow(source, diamond);
};

// ADVANCED: With conditional logic
const conditionalArrow = () => {
  const isPositive = arr<number, boolean>(x => x > 0);
  const positiveFlow = arr<number, string>(x => `Positive: ${x}`);
  const negativeFlow = arr<number, string>(x => `Negative: ${x}`);

  // Using arrow choice combinator
  const conditional = switch(isPositive, positiveFlow, negativeFlow);

  return conditional;
};
```

### 2.4 Performance Implications

**Benefits:**
- **Composition Optimization**: Arrow laws enable algebraic optimization
- **Parallel Execution**: Arrows make parallelism explicit via `&&&`
- **Static Analysis**: Arrow structure known at compile time

**Costs:**
- **Abstraction Overhead**: Extra function calls and object allocations
- **Complexity**: Harder to debug than direct node manipulation
- **Memory**: Arrow objects in addition to nodes

## 3. Graph Coloring for Propagation Optimization

### 3.1 Graph Coloring Fundamentals

Graph coloring assigns colors to nodes such that no two adjacent nodes share the same color. In reactive systems, this enables:

1. **Parallel Execution**: Same-colored nodes can execute simultaneously
2. **Batch Processing**: Group updates by color
3. **Cache Optimization**: Color-based memory layout

### 3.2 Coloring Strategies for Reactive Graphs

#### 3.2.1 Topological Level Coloring

Assign colors based on topological depth:

```typescript
interface ColoredNode extends DerivedNode {
  color: number;  // Topological level
  parallelGroup?: number;  // Sub-group within level
}

function assignTopologicalColors(rootNodes: ProducerNode[]): Map<ReactiveNode, number> {
  const colors = new Map<ReactiveNode, number>();
  const visited = new Set<ReactiveNode>();

  function dfs(node: ReactiveNode, depth: number = 0) {
    if (visited.has(node)) {
      // Update color to max depth if already visited
      colors.set(node, Math.max(colors.get(node) || 0, depth));
      return;
    }

    visited.add(node);
    colors.set(node, depth);

    // Visit dependencies
    if ('subscribers' in node && node.subscribers) {
      let current = node.subscribers;
      while (current) {
        dfs(current.consumer, depth + 1);
        current = current.nextConsumer;
      }
    }
  }

  rootNodes.forEach(node => dfs(node, 0));
  return colors;
}
```

#### 3.2.2 Parallel Execution Coloring

Identify independent subgraphs for parallel execution:

```typescript
class ParallelColoringStrategy {
  private interferenceGraph: Map<ReactiveNode, Set<ReactiveNode>> = new Map();

  buildInterferenceGraph(nodes: Set<ReactiveNode>): void {
    // Two nodes interfere if they share dependencies or dependents
    for (const nodeA of nodes) {
      for (const nodeB of nodes) {
        if (nodeA === nodeB) continue;

        if (this.sharesDependent(nodeA, nodeB) ||
            this.sharesDependency(nodeA, nodeB)) {
          this.addInterference(nodeA, nodeB);
        }
      }
    }
  }

  colorGraph(): Map<ReactiveNode, number> {
    // Greedy coloring algorithm
    const colors = new Map<ReactiveNode, number>();
    const nodes = Array.from(this.interferenceGraph.keys());

    // Sort by degree (nodes with more interference colored first)
    nodes.sort((a, b) =>
      (this.interferenceGraph.get(b)?.size || 0) -
      (this.interferenceGraph.get(a)?.size || 0)
    );

    for (const node of nodes) {
      const neighbors = this.interferenceGraph.get(node) || new Set();
      const usedColors = new Set<number>();

      for (const neighbor of neighbors) {
        const color = colors.get(neighbor);
        if (color !== undefined) usedColors.add(color);
      }

      // Find smallest unused color
      let color = 0;
      while (usedColors.has(color)) color++;
      colors.set(node, color);
    }

    return colors;
  }
}
```

#### 3.2.3 Priority-Based Coloring

Color based on computation cost and update frequency:

```typescript
interface PriorityColoredNode extends DerivedNode {
  color: number;
  priority: number;  // Higher = more important
  updateFrequency: number;  // Rolling average
  computationCost: number;  // Microseconds
}

class PriorityColoring {
  colorByPriority(nodes: Set<PriorityColoredNode>): Map<PriorityColoredNode, number> {
    const colors = new Map<PriorityColoredNode, number>();

    // Sort by priority (cost * frequency)
    const sorted = Array.from(nodes).sort((a, b) => {
      const priorityA = a.computationCost * a.updateFrequency;
      const priorityB = b.computationCost * b.updateFrequency;
      return priorityB - priorityA;  // Descending
    });

    // High-priority nodes get dedicated colors (threads)
    const maxColors = navigator.hardwareConcurrency || 4;
    let colorIndex = 0;

    for (const node of sorted) {
      if (node.computationCost > 1000) {  // >1ms
        // Expensive nodes get dedicated colors
        colors.set(node, colorIndex++ % maxColors);
      } else {
        // Cheap nodes share colors
        colors.set(node, maxColors);
      }
    }

    return colors;
  }
}
```

#### 3.2.4 Change Frequency Coloring

Optimize for temporal locality by grouping frequently co-changing nodes:

```typescript
class ChangeFrequencyColoring {
  private cochangeMatrix: Map<string, Map<string, number>> = new Map();

  recordChange(changedNodes: Set<ReactiveNode>): void {
    for (const nodeA of changedNodes) {
      for (const nodeB of changedNodes) {
        if (nodeA === nodeB) continue;

        const keyA = this.getNodeKey(nodeA);
        const keyB = this.getNodeKey(nodeB);

        if (!this.cochangeMatrix.has(keyA)) {
          this.cochangeMatrix.set(keyA, new Map());
        }

        const current = this.cochangeMatrix.get(keyA)!.get(keyB) || 0;
        this.cochangeMatrix.get(keyA)!.set(keyB, current + 1);
      }
    }
  }

  colorByClustering(nodes: Set<ReactiveNode>): Map<ReactiveNode, number> {
    // Use spectral clustering on co-change matrix
    const clusters = this.spectralClustering(this.cochangeMatrix);
    const colors = new Map<ReactiveNode, number>();

    for (const [nodeKey, clusterIdx] of clusters) {
      const node = this.getNodeByKey(nodeKey);
      if (node) colors.set(node, clusterIdx);
    }

    return colors;
  }
}
```

### 3.3 Integration with Version Tracking

The current version-based tracking can be enhanced with colors:

```typescript
interface ColoredDependency extends Dependency {
  color: number;
  lastPropagationColor?: number;  // Track colored propagation waves
}

class ColoredPropagator {
  propagate(subscribers: ColoredDependency): void {
    // Group by color for batch processing
    const colorGroups = new Map<number, ColoredDependency[]>();

    let current: ColoredDependency | undefined = subscribers;
    while (current) {
      const color = current.color;
      if (!colorGroups.has(color)) {
        colorGroups.set(color, []);
      }
      colorGroups.get(color)!.push(current);
      current = current.nextConsumer as ColoredDependency;
    }

    // Process colors in parallel
    const promises: Promise<void>[] = [];

    for (const [color, deps] of colorGroups) {
      if (deps.length > 100 && color < 4) {  // Parallelize expensive colors
        promises.push(this.processColorAsync(color, deps));
      } else {
        this.processColorSync(color, deps);
      }
    }

    if (promises.length > 0) {
      Promise.all(promises);  // Wait for parallel execution
    }
  }

  private async processColorAsync(color: number, deps: ColoredDependency[]): Promise<void> {
    // Could use Web Workers for true parallelism
    return new Promise(resolve => {
      setTimeout(() => {
        for (const dep of deps) {
          dep.consumer.status = CONSUMER_PENDING;
        }
        resolve();
      }, 0);
    });
  }
}
```

## 4. Concrete Implementation Strategy

### 4.1 Hybrid Architecture

Rather than full replacement, implement arrows as an optional layer:

```typescript
// packages/signals/src/arrow/core.ts
export interface SignalArrow<A, B> {
  // Core arrow interface
  runPush(input: A, ctx: GlobalContext): void;
  runPull(ctx: GlobalContext): B;

  // Composition
  compose<C>(next: SignalArrow<B, C>): SignalArrow<A, C>;
  parallel<C, D>(other: SignalArrow<C, D>): SignalArrow<[A, C], [B, D]>;

  // Optimization hints
  readonly color?: number;
  readonly canParallelize: boolean;
  readonly estimatedCost: number;
}

// Adapter to use arrows with current signals
export function arrowToComputed<A, B>(
  source: () => A,
  arrow: SignalArrow<A, B>
): ComputedFunction<B> {
  return computed(() => {
    const input = source();
    return arrow.runPull({ consumerScope: null } as GlobalContext);
  });
}

// Lift current computed to arrow
export function computedToArrow<T>(
  comp: ComputedFunction<T>
): SignalArrow<void, T> {
  return new LiftedArrow(() => comp());
}
```

### 4.2 Graph Coloring Integration

Add coloring as an optimization pass:

```typescript
// packages/signals/src/helpers/graph-coloring.ts
export class GraphColorOptimizer {
  private colorMap = new WeakMap<ReactiveNode, number>();
  private strategy: ColoringStrategy;

  constructor(strategy: ColoringStrategy = 'topological') {
    this.strategy = strategy;
  }

  optimizeGraph(roots: Set<ProducerNode>): void {
    const allNodes = this.collectAllNodes(roots);

    switch (this.strategy) {
      case 'topological':
        this.applyTopologicalColoring(allNodes);
        break;
      case 'parallel':
        this.applyParallelColoring(allNodes);
        break;
      case 'priority':
        this.applyPriorityColoring(allNodes);
        break;
    }
  }

  getColor(node: ReactiveNode): number {
    return this.colorMap.get(node) || 0;
  }

  getParallelizableGroups(): Map<number, Set<ReactiveNode>> {
    const groups = new Map<number, Set<ReactiveNode>>();

    for (const [node, color] of this.colorMap) {
      if (!groups.has(color)) {
        groups.set(color, new Set());
      }
      groups.get(color)!.add(node);
    }

    return groups;
  }
}
```

### 4.3 Modified Propagation

Enhance current propagation with color awareness:

```typescript
// packages/signals/src/helpers/colored-scheduler.ts
export class ColoredScheduler extends Scheduler {
  private colorOptimizer: GraphColorOptimizer;
  private workerPool?: Worker[];

  constructor(opts: SchedulerOpts & { useColors?: boolean }) {
    super(opts);

    if (opts.useColors) {
      this.colorOptimizer = new GraphColorOptimizer();
      this.initWorkerPool();
    }
  }

  protected scheduleEffect(effect: ScheduledNode): void {
    if (!this.colorOptimizer) {
      return super.scheduleEffect(effect);
    }

    const color = this.colorOptimizer.getColor(effect);

    if (color < 4 && this.workerPool) {
      // Schedule on worker thread
      this.scheduleOnWorker(effect, color);
    } else {
      // Use main thread
      super.scheduleEffect(effect);
    }
  }

  private scheduleOnWorker(effect: ScheduledNode, color: number): void {
    const worker = this.workerPool![color % this.workerPool!.length];

    worker.postMessage({
      type: 'execute',
      effectId: this.getEffectId(effect),
      color
    });
  }
}
```

## 5. Benefits Analysis

### 5.1 Specific Problems Solved

#### Superior Composability
```typescript
// Current: Nested computed with no reuse
const a = computed(() => source() * 2);
const b = computed(() => a() + 10);
const c = computed(() => source() * 2 + 10);  // Duplicates logic

// Arrowized: Reusable transformations
const double = arr(x => x * 2);
const add10 = arr(x => x + 10);
const transform = double >>> add10;
// Can reuse 'transform' anywhere
```

#### Type-Safe Composition
```typescript
// Arrowized approach with full type inference
const parseNumber = arr<string, number>(s => parseInt(s));
const double = arr<number, number>(n => n * 2);
const format = arr<number, string>(n => n.toFixed(2));

// Type error: Can't compose incompatible arrows
// const invalid = parseNumber >>> format;  // Error!

// Correct composition
const pipeline = parseNumber >>> double >>> format;  // string -> string
```

#### Explicit Parallelism
```typescript
// Current: Implicit parallelism requires analysis
const a = computed(() => expensiveA());
const b = computed(() => expensiveB());
const c = computed(() => a() + b());

// Arrowized: Explicit parallel composition
const parallel = expensiveArrowA &&& expensiveArrowB;
const combine = parallel >>> arr(([a, b]) => a + b);
```

### 5.2 Performance Patterns

**Diamond Dependencies:**
- Current: 2-3 traversals (push + pull)
- Arrowized: Single traversal with memoization
- Colored: Parallel execution of siblings

**Fan-out/Fan-in:**
- Current: Sequential processing
- Arrowized: Explicit parallelism via &&&
- Colored: Color-based batching

**Deep Chains:**
- Current: Full chain traversal
- Arrowized: Algebraic optimization possible
- Colored: Pipeline parallelism

## 6. Trade-offs and Challenges

### 6.1 Implementation Complexity

**Added Complexity:**
- Arrow type system (significant)
- Composition operators
- Color assignment algorithms
- Worker thread coordination
- Debugging tools needed

**Learning Curve:**
- Arrows require functional programming knowledge
- Mental model shift from nodes to transformations
- Complex type signatures

### 6.2 Memory Overhead

```typescript
// Memory cost analysis
interface MemoryCosts {
  // Current
  nodeSize: 64,           // bytes per node
  dependencySize: 48,     // bytes per edge

  // Arrowized additions
  arrowSize: 80,          // bytes per arrow
  compositionSize: 32,    // bytes per composition

  // Coloring additions
  colorMapEntry: 16,      // bytes per color mapping
  interferenceEdge: 24,   // bytes per interference
}

// For 1000 nodes with avg 3 dependencies:
// Current: ~200KB
// Arrowized: ~280KB (+40%)
// With coloring: ~300KB (+50%)
```

### 6.3 Runtime Overhead

**Arrow Abstraction Cost:**
- Extra function calls: ~5-10ns per arrow
- Composition overhead: ~20ns per >>>
- Type checking in dev: ~50ns per composition

**Coloring Cost:**
- Initial coloring: O(V + E) = ~1-10ms for 1000 nodes
- Re-coloring on structure change: ~5ms
- Color lookup: O(1) but adds cache miss

## 7. Comparison with Current Approach

### 7.1 Side-by-Side Comparison

| Aspect | Current Node-Based | Arrowized FRP | Winner |
|--------|-------------------|---------------|---------|
| **Performance** | Excellent | Good-Excellent | Current (simpler) |
| **Composability** | Limited | Excellent | Arrowized |
| **Type Safety** | Good | Excellent | Arrowized |
| **Debugging** | Good | Complex | Current |
| **Memory Usage** | Baseline | +40-50% | Current |
| **Parallelism** | Implicit | Explicit | Arrowized |
| **Learning Curve** | Moderate | Steep | Current |
| **Maintenance** | Simple | Complex | Current |

### 7.2 Use Case Analysis

**Where Current Excels:**
- Simple reactive UIs
- Straightforward dependency graphs
- Memory-constrained environments
- Teams without FP expertise

**Where Arrowized Excels:**
- Complex signal processing
- Audio/video pipelines
- Scientific computing
- Highly parallel workloads

**Where Coloring Helps:**
- Large graphs (>1000 nodes)
- Multi-core utilization needed
- Batch processing scenarios
- Real-time systems

## 8. Novel Hybrid Ideas

### 8.1 Arrow API with Node Runtime

Keep the efficient node-based runtime but provide arrow-style API:

```typescript
// Arrow-style API that compiles to nodes
class ArrowAPI {
  // User writes this
  static create() {
    const transform = arr(x => x * 2) >>> arr(x => x + 1);
    return applyTo(signal(0), transform);
  }

  // Compiles to this
  private static compile() {
    const source = signal(0);
    const step1 = computed(() => source() * 2);
    const step2 = computed(() => step1() + 1);
    return step2;
  }
}
```

### 8.2 Selective Arrowization

Use arrows only for hot paths:

```typescript
// Identify hot paths via profiling
class HotPathOptimizer {
  private hotPaths = new Map<string, SignalArrow<any, any>>();

  optimizeHotPath(path: ComputedFunction<any>): void {
    const pathId = this.getPathId(path);

    if (this.isHot(pathId)) {
      // Convert to arrow for optimization
      const arrow = this.extractArrow(path);
      const optimized = this.optimizeArrow(arrow);
      this.hotPaths.set(pathId, optimized);
    }
  }

  private optimizeArrow(arrow: SignalArrow<any, any>): SignalArrow<any, any> {
    // Apply arrow-specific optimizations
    return arrow.memoize().parallelize().fuse();
  }
}
```

### 8.3 Incremental Graph Coloring

Add coloring only where beneficial:

```typescript
class IncrementalColoring {
  private coloredSubgraphs = new Set<ReactiveNode>();

  shouldColor(node: ReactiveNode): boolean {
    // Color only if subgraph is large enough
    const subgraphSize = this.getSubgraphSize(node);
    const avgComputationTime = this.getAvgComputationTime(node);

    return subgraphSize > 50 && avgComputationTime > 1; // ms
  }

  colorIncremental(node: ReactiveNode): void {
    if (this.shouldColor(node)) {
      const subgraph = this.extractSubgraph(node);
      const colors = this.colorSubgraph(subgraph);
      this.applyColors(colors);
    }
  }
}
```

### 8.4 Hybrid Push-Pull-Arrow

Three-phase execution model:

```typescript
class HybridExecutor {
  // Phase 1: Push invalidation (current)
  push(source: ProducerNode): void {
    this.invalidateDownstream(source);
  }

  // Phase 2: Arrow optimization (new)
  optimize(invalidated: Set<ReactiveNode>): ExecutionPlan {
    const arrows = this.detectArrowPatterns(invalidated);
    return this.planExecution(arrows);
  }

  // Phase 3: Pull computation (current)
  pull(node: DerivedNode, plan: ExecutionPlan): any {
    if (plan.hasOptimization(node)) {
      return plan.executeOptimized(node);
    }
    return this.standardPull(node);
  }
}
```

## 9. Recommendation

### Assessment

While arrowized FRP with graph coloring is intellectually compelling and offers theoretical advantages, the practical benefits for @lattice/signals may not justify the implementation complexity:

**Pros:**
- Superior composability and type safety
- Explicit parallelism opportunities
- Potential for algebraic optimizations
- Academic/research appeal

**Cons:**
- Significant implementation complexity
- 40-50% memory overhead
- Steep learning curve
- Limited practical benefit for typical reactive UI patterns
- Current implementation already highly optimized

### Recommended Path Forward

1. **Keep Current Core**: The existing push-pull implementation is excellent for the target use case

2. **Add Optional Arrow API**: Implement a thin arrow-style API layer that compiles to current nodes:
   ```typescript
   // Optional import for those who want it
   import { arr, >>> } from '@lattice/signals/arrows';
   ```

3. **Selective Coloring**: Add graph coloring only for large graphs as an optimization:
   ```typescript
   // Opt-in for applications that need it
   import { enableGraphColoring } from '@lattice/signals/optimizations';
   ```

4. **Experiment with Hot Paths**: Profile real applications to identify if arrow optimizations would help specific patterns

5. **Consider Incremental Computation First**: The incremental computation techniques (already documented) would provide more practical benefit

### Alternative Approach: Best of Both Worlds

Instead of full arrowization, enhance the current system with arrow-inspired features:

```typescript
// Enhanced computed with arrow-like composition
export function computed<T>(fn: () => T): ComputedFunction<T> & {
  map<U>(f: (t: T) => U): ComputedFunction<U>;
  chain<U>(f: (t: T) => ComputedFunction<U>): ComputedFunction<U>;
  zip<U>(other: ComputedFunction<U>): ComputedFunction<[T, U]>;
} {
  const comp = createComputed(fn);

  // Add arrow-like methods
  comp.map = (f) => computed(() => f(comp()));
  comp.chain = (f) => computed(() => f(comp())());
  comp.zip = (other) => computed(() => [comp(), other()]);

  return comp;
}

// Usage feels arrow-like but uses existing runtime
const result = computed(() => source())
  .map(x => x * 2)
  .map(x => x + 1)
  .zip(computed(() => otherSource()));
```

## 10. Conclusion

Arrowized FRP with graph coloring represents a sophisticated evolution of reactive programming, offering superior composability, type safety, and parallelization opportunities. However, for @lattice/signals' target use case (reactive UIs with moderate-sized dependency graphs), the current push-pull implementation with version tracking is already near-optimal.

The recommendation is to:
1. Maintain the current efficient core
2. Add optional arrow-style APIs for better ergonomics
3. Implement selective graph coloring for large graphs
4. Focus on incremental computation for practical performance gains

This pragmatic approach preserves the simplicity and efficiency of the current implementation while selectively adopting the most beneficial concepts from arrow theory and graph algorithms where they provide concrete value.

## References

1. Hughes, J. (2000). "Generalising Monads to Arrows". Science of Computer Programming.

2. Nilsson, H., Courtney, A., & Peterson, J. (2002). "Functional Reactive Programming, Continued". Haskell Workshop.

3. Liu, H., & Hudak, P. (2007). "Plugging a Space Leak with an Arrow". Electronic Notes in Theoretical Computer Science.

4. Czaplicki, E., & Chong, S. (2013). "Asynchronous Functional Reactive Programming for GUIs". PLDI.

5. Elliott, C. (2009). "Push-pull functional reactive programming". Haskell Symposium.

6. Perez, I., & Nilsson, H. (2017). "Testing and Debugging Functional Reactive Programming". ICFP.

7. Courtney, A. (2001). "Yampa: Functional Reactive Programming with Arrows". Yale University.

8. Jeffrey, A. (2012). "LTL types FRP: Linear-time Temporal Logic Propositions as Types". PLPV.

## Appendix: Implementation Sketches

### A. Basic Arrow Combinators

```typescript
// Core arrow type
abstract class Arrow<A, B> {
  abstract run(input: A): B;

  // Category operations
  compose<C>(g: Arrow<B, C>): Arrow<A, C> {
    return new ComposedArrow(this, g);
  }

  // Arrow operations
  first<C>(): Arrow<[A, C], [B, C]> {
    return new FirstArrow(this);
  }

  parallel<C, D>(g: Arrow<C, D>): Arrow<[A, C], [B, D]> {
    return new ParallelArrow(this, g);
  }

  // Convenience operators
  ['>>>'](g: Arrow<B, any>) {
    return this.compose(g);
  }

  ['&&&']<C>(g: Arrow<A, C>): Arrow<A, [B, C]> {
    return new FanoutArrow(this, g);
  }
}

// Lift pure function to arrow
class PureArrow<A, B> extends Arrow<A, B> {
  constructor(private f: (a: A) => B) {
    super();
  }

  run(input: A): B {
    return this.f(input);
  }
}

// Sequential composition
class ComposedArrow<A, B, C> extends Arrow<A, C> {
  constructor(
    private f: Arrow<A, B>,
    private g: Arrow<B, C>
  ) {
    super();
  }

  run(input: A): C {
    return this.g.run(this.f.run(input));
  }
}
```

### B. Graph Coloring Algorithm

```typescript
// Efficient graph coloring using bit sets
class FastGraphColoring {
  private adjacency: Map<number, Set<number>> = new Map();
  private colors: Uint8Array;

  constructor(private nodeCount: number) {
    this.colors = new Uint8Array(nodeCount);
  }

  addEdge(from: number, to: number): void {
    if (!this.adjacency.has(from)) {
      this.adjacency.set(from, new Set());
    }
    if (!this.adjacency.has(to)) {
      this.adjacency.set(to, new Set());
    }
    this.adjacency.get(from)!.add(to);
    this.adjacency.get(to)!.add(from);
  }

  colorGreedy(): void {
    // Welsh-Powell algorithm
    const degrees = new Array(this.nodeCount);
    for (let i = 0; i < this.nodeCount; i++) {
      degrees[i] = [i, this.adjacency.get(i)?.size || 0];
    }

    // Sort by degree (descending)
    degrees.sort((a, b) => b[1] - a[1]);

    for (const [node] of degrees) {
      const neighbors = this.adjacency.get(node) || new Set();
      const usedColors = new Set<number>();

      for (const neighbor of neighbors) {
        usedColors.add(this.colors[neighbor]);
      }

      // Find first available color
      let color = 1;
      while (usedColors.has(color)) color++;

      this.colors[node] = color;
    }
  }

  getColor(node: number): number {
    return this.colors[node];
  }

  getMaxColor(): number {
    return Math.max(...this.colors);
  }
}
```

### C. Parallel Executor

```typescript
// Web Worker-based parallel execution
class ParallelExecutor {
  private workers: Worker[] = [];
  private taskQueue: Map<number, Task[]> = new Map();

  constructor(workerCount: number = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < workerCount; i++) {
      this.workers.push(new Worker('/arrow-worker.js'));
    }
  }

  async executeColored(
    nodes: Map<ReactiveNode, number>,
    colors: number
  ): Promise<void> {
    // Group by color
    const groups = new Map<number, ReactiveNode[]>();
    for (const [node, color] of nodes) {
      if (!groups.has(color)) {
        groups.set(color, []);
      }
      groups.get(color)!.push(node);
    }

    // Execute each color in parallel
    const promises: Promise<void>[] = [];

    for (let color = 0; color < colors; color++) {
      const nodes = groups.get(color) || [];
      if (nodes.length > 0) {
        promises.push(this.executeOnWorker(color % this.workers.length, nodes));
      }
    }

    await Promise.all(promises);
  }

  private executeOnWorker(
    workerId: number,
    nodes: ReactiveNode[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.workers[workerId];

      worker.postMessage({
        type: 'execute',
        nodes: nodes.map(n => this.serializeNode(n))
      });

      worker.onmessage = (e) => {
        if (e.data.type === 'complete') {
          resolve();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message));
        }
      };
    });
  }
}
```
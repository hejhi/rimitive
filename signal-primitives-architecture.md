# Signal Primitives Architecture Proposal

This proposal outlines a declaration-time transformation architecture for signal primitives - a system that enables custom signal behaviors through constructor composition.

## Core Concepts

### 1. Declaration-Time Transformation

Signal primitives operate at declaration time, not runtime:

```typescript
const count = signal(mut(0));
// mut() returns a constructor that signal() uses
// No runtime checks needed after creation
```

This approach performs all customization at signal creation time, keeping hot paths clean.

### 2. Constructor Protocol

Primitives return factory functions that create enhanced signals:

```typescript
interface SignalFactory<T> {
  createSignal(): Signal<T>;
  enhance<U>(primitive: Primitive<T, U>): SignalFactory<U>;
}
```

The `signal()` function detects factories and delegates construction to them.

### 3. Prototype-Based Enhancement

Primitives customize behavior through direct prototype manipulation:

- Override methods on signal instances
- Create prototype chains for composition
- Maintain native JavaScript performance

## Architectural Patterns

### 1. Factory Composition

Primitives compose by wrapping constructor functions:

```typescript
// Each primitive wraps the previous factory
persist('key') → mut() → base signal
```

This creates a natural composition order without runtime coordination.

### 2. Direct Method Override

Enhanced signals override hot-path methods directly:

- No conditional checks in getters/setters
- V8 can inline overridden methods
- Same performance as hand-written specialized signals

### 3. Enhancement Protocol

Each primitive follows a simple protocol:

1. Accept initial value or inner factory
2. Return a factory function
3. Factory creates enhanced signal instance
4. Instance has customized prototype

## Design Principles

### 1. Performance First

The architecture prioritizes performance:

- **Declaration-time transformation** - Customization happens once at creation
- **Direct method calls** - No indirection in hot paths
- **Minimal allocations** - Reuse prototypes across instances
- **V8 optimization friendly** - Predictable object shapes

### 2. Composition Through Construction

Primitives compose at declaration time:

- Order of composition is explicit
- Each layer wraps the constructor
- No runtime primitive registry needed
- Type information flows naturally

### 3. Simplicity Through Prototypes

JavaScript's prototype system provides the enhancement mechanism:

- Natural method override semantics
- Efficient prototype chain traversal
- Built-in composition support
- Familiar debugging experience

## Performance Characteristics

### Declaration Time

- One-time cost during signal creation
- Constructor composition overhead (~100-200ns)
- Prototype setup cost

### Runtime (Hot Path)

- Direct property access with no conditional logic
- No branching or indirection
- V8 optimization friendly
- Same performance as hand-written specialized signals

### Memory

- Small prototype object per primitive type
- Shared method implementations across instances
- Minimal per-instance overhead (prototype pointer)
- Efficient GC behavior

## Type Safety

### Static Typing

The factory pattern preserves type information:

```typescript
type MutSignal<T> = Signal<T> & {
  /* mut-specific methods */
};
type Factory<T> = { createSignal(): MutSignal<T> };
```

TypeScript can track transformations through the factory chain.

### Inference

Primitives declare their type transformations:

```typescript
declare function mut<T>(value: T): Factory<T>;
```

This enables full type inference without explicit annotations.

## Primitive Categories

### Current Primitives

- `mut`: Shallow mutation tracking for arrays and objects

### Criteria for Future Primitives

New primitives should only be added if they:
1. Solve a real, common problem
2. Represent fundamentally different reactive behavior
3. Cannot be solved through existing means

## Composition Patterns

### 1. Primitive Declaration

The `mut` primitive creates a specialized signal type:

```typescript
signal(mut([]));        // Mutable array signal
signal(mut({ ... }));   // Mutable object signal
```

### 2. Type Transformation

The primitive transforms the base signal type:

```typescript
Signal<Array> → mut → MutSignal<Array>
```

### 3. Prototype Specialization

Mut signals have specialized prototypes:

```typescript
MutArraySignal.prototype.push    // Direct array methods
MutObjectSignal.prototype        // Property-based tracking (no proxy)
```

## Extension Guidelines

### 1. Creating Primitives

New primitives should:

- Accept a value or factory
- Return a factory function
- Override only necessary methods
- Preserve unmodified behavior

### 2. Performance Considerations

- Minimize prototype chain depth
- Avoid hidden class transitions
- Cache prototype objects
- Use method extraction for hot paths

### 3. Debugging Support

- Maintain clear prototype names
- Preserve stack traces
- Add development-mode helpers
- Support DevTools inspection

## Migration Strategy

### Phase 1: Core Implementation

- Update `signal()` to detect factories
- Implement factory protocol
- Maintain backward compatibility

### Phase 2: Reference Primitive

- Implement `mut` as reference
- Benchmark against current approach
- Validate composition model

### Phase 3: Ecosystem

- Port existing primitives
- Document creation patterns
- Enable community primitives

## Success Criteria

1. **Performance**: Zero overhead in hot paths (getter/setter)
2. **Bundle Size**: Under 350 bytes for core + mut (hybrid approach)
3. **Developer Experience**: Direct array mutations, tracked object properties
4. **Type Safety**: Full TypeScript inference
5. **Simplicity**: Clear semantics without proxy complexity

## Future Considerations

### 1. Build Tool Compatibility

- Structure code for optimal tree-shaking
- Enable dead code elimination for unused primitives
- Support bundler optimizations through clean module boundaries

### 2. Development Tools

- Prototype chain visualizer
- Performance profiler integration
- Composition analyzer

### 3. Advanced Patterns

- Conditional primitives
- Dynamic primitive loading
- Cross-primitive communication

## Summary

Signal primitives enable specialized reactive behaviors through declaration-time markers. The `mut` primitive allows direct array and object mutations while maintaining reactivity, using prototype specialization to achieve zero runtime overhead.

The architecture is extensible but additional primitives require strong justification.

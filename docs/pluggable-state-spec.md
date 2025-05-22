# Lattice: Pluggable State Management Architecture

## Overview

Lattice is a **composition layer** that allows users to define behavior and state as contracts, exposing a consistent API surface for both composition and runtime. The core architectural insight is a clean separation between **behavior definition** and **infrastructure management**:

- **Lattice Core**: Pure component behavior specifications using VSAM patterns
- **Store Adapters**: Data management including persistence, middleware, and state orchestration  
- **Framework Adapters**: UI consumption including hooks, reactivity, and framework-specific optimizations

This dual-adapter architecture enables component libraries to focus entirely on behavior while users retain complete control over both their state management strategy and framework integration approach.

## Core Architecture

### Separation of Concerns

**Lattice Core Responsibilities:**
- Component behavior specification using VSAM (View-Selector-Action-Model) patterns
- Type-safe composition APIs with unified `{ set, get }` contracts
- Framework-agnostic and store-agnostic component definitions
- Pure function composition without infrastructure dependencies

**Store Adapter Responsibilities:**
- Data storage and persistence strategies (memory, localStorage, server, database)
- State orchestration and subscription mechanisms
- Middleware integration (devtools, immer, analytics, persistence, etc.)
- Performance optimizations for data operations
- Infrastructure concerns completely separate from component logic

**Framework Adapter Responsibilities:**
- UI consumption patterns (hooks, reactive refs, computed properties)
- Framework-specific reactivity and subscription optimization
- Integration with framework devtools and ecosystems
- Rendering performance and update batching
- Platform-specific UI concerns (web, mobile, desktop)

**Key Insight:** Components are defined as pure behavior specifications, while both data management and UI consumption choices are made at instantiation time per component instance.

### Conceptual Flow

**1. Component Definition Phase (Pure Behavior)**
- Authors define components using only VSAM patterns and `{ set, get }` contracts
- No knowledge of or dependency on infrastructure or framework choices
- Components are portable, testable behavior specifications

**2. Store Adapter Selection (Data Infrastructure)**  
- Users choose store adapters based on their data management needs
- Adapters handle persistence, middleware, state orchestration, and performance
- Multiple instances of the same component can use different store adapters

**3. Framework Adapter Selection (UI Infrastructure)**
- Users choose framework adapters based on their UI platform and consumption patterns
- Adapters handle reactivity, hooks, framework integration, and rendering optimization
- Same store can be consumed differently across frameworks

**4. Adapter Coupling Considerations**
- Some combinations are naturally independent (memory stores work across frameworks)
- Some combinations are inherently coupled (NextJS requires React, Vue reactivity works best with Vue)
- Architecture accommodates both scenarios with smart defaults and validation

**5. Runtime Execution (Unified Interface)**
- All adapters present consistent interfaces to components
- Component behavior remains identical regardless of backing infrastructure
- Users get full ecosystem compatibility with their chosen stack

## Store Adapter Ecosystem

### Store Adapter Categories

**Memory-Based Store Adapters**
- Zustand: High-performance reactive state with rich middleware ecosystem
- Custom: Minimal implementation for specific performance requirements  
- Jotai: Atomic state management with bottom-up composition

**Persistence-Based Store Adapters**
- NextJS: Server actions and server components integration (React-coupled)
- Redux: Integration with existing Redux/RTK applications (primarily React-coupled)
- Database: Direct database persistence with optimistic updates

**Specialized Store Adapters**
- Analytics: State change tracking and user behavior analysis
- Offline: Offline-first with sync capabilities  
- Multi-tenant: Instance isolation for SaaS applications

## Framework Adapter Ecosystem

### Framework Adapter Categories

**React Adapters**
- React Hooks: `useSelectors()`, `useActions()`, `useView()` with optimized re-rendering
- React Server: Integration with React Server Components and Suspense
- React Native: Mobile-optimized hooks with platform-specific considerations

**Vue Adapters**  
- Vue Composition: Reactive refs and computed properties with Vue's reactivity system
- Vue Options: Integration with Options API and traditional Vue patterns
- Nuxt: Server-side rendering and hydration optimizations

**Framework-Agnostic Adapters**
- Vanilla: Direct state access and manual subscription management
- Svelte: Reactive stores and auto-subscription patterns
- Solid: Fine-grained reactivity integration

### Adapter Coupling Patterns

**Independent Combinations**
- Memory-based stores (Zustand, Custom, Jotai) work with any framework adapter
- Framework adapters can consume any store that provides standard subscription interface
- Maximum flexibility for mixing and matching based on specific needs

**Naturally Coupled Combinations**  
- NextJS store adapter inherently requires React framework adapter
- Vue reactivity store adapter works optimally with Vue framework adapter
- Framework-specific stores leverage platform-specific optimizations

**Hybrid Scenarios**
- Redux store adapter works primarily with React but can adapt to other frameworks
- Custom store adapters can be designed for specific framework optimizations
- Specialized adapters may target specific framework capabilities

### Middleware Integration Philosophy

**Store adapters serve as middleware orchestration platforms:**

- **Development Tools**: Redux DevTools, time-travel debugging, state inspection
- **Data Transformation**: Immer for immutable updates, normalization libraries
- **Persistence**: LocalStorage, SessionStorage, IndexedDB, server sync
- **Performance**: Memoization, batching, selective subscriptions
- **Observability**: Analytics, error tracking, performance monitoring
- **Framework Integration**: React DevTools, Vue DevTools, framework-specific optimizations

**Key Principle**: Lattice never reimplements existing infrastructure tooling - it provides the composition layer that works with any existing middleware ecosystem.

### Adapter Implementation Principles

**Unified Interface Contract**
- All adapters expose the same `{ set, get }` interface to component models
- Components remain completely agnostic to the underlying infrastructure
- Type safety maintained across all adapter implementations

**Middleware Composition**
- Adapters support composable middleware stacks specific to their ecosystem
- Existing middleware from Zustand, Redux, etc. works without modification
- Custom middleware can be developed per adapter type

**Performance Optimization**
- Each adapter optimizes for its specific use case and infrastructure
- Memory-based adapters focus on subscription efficiency and batching
- Persistence-based adapters focus on optimistic updates and sync strategies
- Specialized adapters implement domain-specific optimizations

**Ecosystem Integration**
- Adapters bring their entire ecosystem (devtools, middleware, tooling)
- No need to reimplement existing solutions
- Users get full ecosystem benefits with Lattice composition patterns

## Architectural Benefits

### For Component Authors

**Pure Behavior Focus**
- Authors define only component logic using VSAM patterns
- No infrastructure dependencies or assumptions in component code
- Components are portable across different deployment contexts
- Testing simplified through pure function composition

**Framework Agnostic**
- Same component works in React, Vue, Svelte, or vanilla JavaScript
- No need to build framework-specific versions
- Behavior specifications remain consistent across platforms

### For Application Developers

**Infrastructure Control**
- Choose state management strategy per component instance
- Apply middleware stacks tailored to specific use cases
- Integrate with existing application architecture without migration
- Mix different persistence strategies within the same application

**Incremental Adoption**
- Add Lattice components to existing codebases without architectural changes
- Maintain existing Redux/Zustand/custom state management
- Gradually migrate components while keeping infrastructure intact

**Performance Optimization**
- Select appropriate adapter for each component's performance requirements
- Apply optimizations (memoization, batching, etc.) at the infrastructure level
- Fine-tune persistence and subscription strategies per instance

### For Ecosystem Development

**Middleware Compatibility**
- Existing ecosystem middleware works without modification
- No need to reimplement devtools, persistence, analytics solutions
- Community can build specialized adapters for domain-specific needs

**Innovation Space**
- New state management approaches can be integrated as adapters
- Experimental features isolated to adapter level
- Core composition patterns remain stable while infrastructure evolves

## Adoption Scenarios

### Hybrid Applications
- **Performance-Critical Components**: Use memory-based adapters (Zustand) for high-frequency interactions
- **Data-Heavy Components**: Use persistence-based adapters (NextJS, Database) for server-state integration  
- **Development vs Production**: Different adapter configurations for development debugging vs production optimization

### Greenfield Projects
- **Pure Lattice Architecture**: Start with component behavior specifications, choose adapters per deployment context
- **Multi-Platform Applications**: Same components across web, mobile, desktop with platform-appropriate adapters
- **Microservice Integration**: Different adapters for different service boundaries and data sources

## Implementation Strategy

### Current Codebase Impact

**Minimal changes needed:**
- Core VSAM composition logic remains unchanged
- Only `slice` logic needs refactoring (already planned)
- Framework adapters unaffected
- `from()` API unchanged

**New additions:**
- State engine adapter system
- Adapter packages (`lattice/zustand`, `lattice/redux`, etc.)
- Core package (`lattice/core`) with state-agnostic logic

### Package Structure
```
lattice/
├── core/           # State-agnostic VSAM composition
├── zustand/        # Zustand state engine adapter  
├── redux/          # Redux Toolkit adapter
├── jotai/          # Jotai adapter
├── valtio/         # Valtio adapter
└── custom/         # Minimal custom adapter
```

## Benefits

### For Users
- **No vendor lock-in**: Choose the best state engine for each use case
- **Gradual adoption**: Add Lattice to existing codebases without migration
- **Consistent API**: Same composition patterns regardless of state engine
- **Performance options**: Pick the right tool for performance requirements

### For Lattice
- **Broader adoption**: Works with any team's existing state preferences
- **Ecosystem growth**: Community can build adapters for any state solution
- **Future-proof**: New state engines can be supported without core changes
- **Simpler core**: Focus on composition patterns, not state management specifics

## Open Questions

1. **Adapter API**: Should adapters expose additional methods beyond the core contract?
2. **Type safety**: How to ensure TypeScript safety across different adapters?
3. **Performance**: Should there be adapter performance benchmarks/guidelines?
4. **Compatibility**: How to handle adapter-specific features in shared components?

## Next Steps

1. Extract state-agnostic core from current Zustand implementation
2. Build Zustand adapter as reference implementation
3. Create minimal custom adapter for testing
4. Design adapter packaging and distribution strategy
5. Update documentation with pluggable architecture examples
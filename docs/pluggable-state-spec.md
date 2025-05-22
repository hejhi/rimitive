# Lattice: Pluggable State Management Architecture

## Overview

Lattice is a **composition layer** that allows users to define behavior and state as contracts, exposing a consistent API surface for both composition and runtime. The core architectural insight is a clean separation between **behavior definition** and **infrastructure management**:

- **Lattice Core**: Pure component behavior specifications using VSAM patterns
- **Store Adapters**: Data management including persistence, middleware, and state orchestration  
- **Framework Adapters**: UI consumption including hooks, reactivity, and framework-specific optimizations

This dual-adapter architecture enables component libraries to focus entirely on behavior while users retain complete control over both their state management strategy and framework integration approach.

## Core Architecture

### Separation of Concerns

**Lattice Core Responsibilities (Composition Only):**
- Component behavior specification using VSAM (View-Selector-Action-Model) patterns
- Type-safe composition APIs returning slice factories (specifications)
- Framework-agnostic and store-agnostic component definitions
- Pure function composition without infrastructure dependencies
- **NEVER implements actual state management, UI rendering, or persistence**

**Store Adapter Responsibilities (Data Infrastructure):**
- Consume slice factories from Lattice Core
- Execute slice factories with runtime tools (`set`, `get`, model access)
- Create unified stores from separate slices (model, selectors, actions)
- Provide standardized Lattice API for framework adapters
- Handle persistence, middleware integration, and performance optimizations
- Bridge factory-time specifications to runtime state management

**Framework Adapter Responsibilities (UI Infrastructure):**
- Consume standardized Lattice API from any store adapter
- Create framework-specific interfaces (hooks, reactive refs, computed properties)
- Handle framework-specific reactivity and subscription optimization
- Enable mix-and-match with any compatible store adapter
- Integration with framework devtools and rendering performance

**Key Insight:** Lattice Core creates specifications only. Store adapters fulfill specifications with actual infrastructure. Framework adapters consume the standardized API to create UI interfaces. This dual-adapter system enables complete mix-and-match flexibility.

### Conceptual Flow

**1. Component Definition Phase (Factory-Time - Specifications Only)**
- Authors define components using VSAM patterns, returning slice factories
- Components specify contracts (`{ set, get }` for models, `{ model }` for selectors/actions)
- No knowledge of or dependency on infrastructure or framework choices
- Output: Slice factory specifications that can be executed later

**2. Store Adapter Selection (Runtime - Data Infrastructure)**  
- Users choose store adapters based on their data management needs
- Store adapters consume slice factories and execute them with runtime tools
- Store adapters create unified stores and return standardized Lattice API
- Multiple instances of the same component can use different store adapters

**3. Framework Adapter Selection (Runtime - UI Infrastructure)**
- Users choose framework adapters based on their UI platform and consumption patterns
- Framework adapters consume standardized Lattice API from any store adapter
- Framework adapters create framework-specific interfaces (hooks, composables, etc.)
- Same standardized API can be consumed by different framework adapters

**4. Adapter Coupling Considerations**
- Universal store adapters (Zustand, Redux, Jotai) work with any framework adapter
- Coupled store adapters (NextJS requires React, Nuxt requires Vue) are type-enforced
- Builder pattern with `.with()` provides type-safe compatibility declarations
- Architecture accommodates both scenarios with compile-time validation

**5. Runtime Execution (Mix-and-Match Flexibility)**
- Same behavior specifications work with any compatible adapter combination
- Store adapters provide actual state management infrastructure
- Framework adapters provide actual UI reactivity and integration
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

**Store Adapter Contract**
- Consume slice factories from Lattice Core component definitions
- Execute slice factories with appropriate runtime tools (`set`, `get`, model access)
- Create unified stores from separate slices with proper dependency injection
- Return standardized Lattice API that framework adapters can consume
- Handle namespacing (selectors need `{ model: () => get().model }`)

**Framework Adapter Contract**
- Consume standardized Lattice API from any store adapter
- Create framework-specific interfaces (hooks, composables, direct access)
- Handle framework-specific reactivity, subscription, and optimization patterns
- Remain agnostic to which store adapter provided the Lattice API

**Standardized Lattice API (Missing - See TODO.md)**
- Interface that all store adapters must implement
- Interface that all framework adapters can consume
- Enables mix-and-match compatibility between any store and framework adapter
- **Critical missing piece**: Must be defined before adapter ecosystem can be built

**Middleware Composition**
- Store adapters orchestrate middleware stacks specific to their ecosystem
- Existing middleware from Zustand, Redux, etc. works without modification
- Framework adapters handle framework-specific tooling and devtools integration

**Performance Optimization**
- Store adapters optimize data operations (subscription efficiency, batching)
- Framework adapters optimize UI operations (rendering, reactivity)
- Each adapter specializes in its domain without cross-concerns

**Ecosystem Integration**
- Adapters bring their entire ecosystem (devtools, middleware, tooling)
- No need to reimplement existing solutions in Lattice Core
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

## Resolved Architecture Decisions

1. **Dual-Adapter Pattern**: Separate store adapters (data) from framework adapters (UI) for maximum mix-and-match flexibility
2. **Factory-Time vs Runtime**: Lattice Core creates specifications only, adapters handle all runtime execution
3. **Adapter Coupling**: Builder pattern with `.with()` provides type-safe compatibility declarations
4. **Slice Factory Execution**: Store adapters execute slice factories with runtime tools and handle dependency injection

## Critical Missing Pieces (See TODO.md)

1. **Standardized Lattice API Interface**: Must be defined before any adapter implementations
2. **Builder Pattern Implementation**: Type-safe `.with()` compatibility system
3. **Adapter Packaging Strategy**: How to distribute and version adapters
4. **Reference Implementation**: Zustand store adapter as ecosystem starting point

## Next Steps

1. **Define standardized Lattice API interface** (blocks all adapter work)
2. Build Zustand store adapter as reference implementation
3. Build React framework adapter as reference implementation
4. Create adapter compatibility builder pattern
5. Extract state-agnostic core from current Zustand implementation
6. Design adapter packaging and distribution strategy
7. Update documentation with concrete adapter examples
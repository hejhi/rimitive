# DevTools Store Modules

This directory contains the refactored store modules for the Lattice DevTools extension.

## Module Structure

### `messageHandler.ts`
- Handles incoming messages from the DevTools bridge
- Routes messages to appropriate handlers
- Manages state updates

### `transactionProcessor.ts`
- Creates and categorizes transactions
- Manages transaction history

### `contextManager.ts`
- Manages Lattice contexts
- Handles creation and updates of signals, computeds, and effects
- Auto-selects contexts

### `dependencyGraph.ts`
- Manages the reactive dependency graph
- Handles graph updates and snapshots
- Tracks node relationships

### `logProcessor.ts`
- Processes execution logs
- Tracks causality between reactive updates
- Manages log entries for the timeline view

### `executionState.ts`
- Tracks active computations and effects
- Manages execution levels for proper log indentation
- Tracks recent writes for causality analysis

### `eventTypes.ts`
- Type definitions for Lattice events
- Shared event data interfaces

## Data Flow

1. Messages arrive via `handleDevToolsMessage`
2. Transaction processor creates transaction records
3. Context manager updates context metadata
4. Log processor creates detailed execution logs
5. Dependency graph tracks reactive relationships

## Key Improvements

- **Separation of Concerns**: Each module has a single responsibility
- **Type Safety**: Strong typing throughout with no `any` types
- **Testability**: Each module can be tested independently
- **Maintainability**: Smaller files are easier to understand and modify
- **Performance**: Efficient data structures and minimal state mutations
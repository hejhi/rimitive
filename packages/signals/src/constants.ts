/**
 * Optimized State Machine Flag System
 * 
 * Direct bit operations for maximum performance while maintaining
 * mutually exclusive states and combinable properties.
 */

// Node States (mutually exclusive - a node can only be in one state)
const enum NodeState {
  Clean         = 0,      // No state flags - up to date and ready
  Invalidated   = 1 << 0, // Dependencies might have changed, needs checking
  Dirty         = 1 << 1, // Definitely needs recomputation
  Checking      = 1 << 2, // Currently checking staleness (replaces RUNNING for stale checks)
  Recomputing   = 1 << 3, // Currently recomputing value (replaces RUNNING for computations)
  Disposed      = 1 << 4, // Node is dead and should be ignored
}

// Node Properties (can combine with states)
const enum NodeProps {
  ValueChanged  = 1 << 5, // Value changed on last recomputation
  Scheduled     = 1 << 6, // Node is in the work queue
}

// State masks for efficient checking
const STATE_MASK = NodeState.Invalidated | NodeState.Dirty | NodeState.Checking | NodeState.Recomputing | NodeState.Disposed;
const PROPERTY_MASK = NodeProps.ValueChanged | NodeProps.Scheduled;
const UPDATE_NEEDED = NodeState.Invalidated | NodeState.Dirty;
const IN_PROGRESS = NodeState.Checking | NodeState.Recomputing;
const SKIP_NODE = NodeState.Disposed | IN_PROGRESS;

export const CONSTANTS = {
  // States
  CLEAN: NodeState.Clean,
  INVALIDATED: NodeState.Invalidated,
  DIRTY: NodeState.Dirty,
  CHECKING: NodeState.Checking,
  RECOMPUTING: NodeState.Recomputing,
  DISPOSED: NodeState.Disposed,
  
  // Properties
  VALUE_CHANGED: NodeProps.ValueChanged,
  SCHEDULED: NodeProps.Scheduled,
  
  // Masks for efficient operations
  STATE_MASK,
  PROPERTY_MASK,
  UPDATE_NEEDED,
  IN_PROGRESS,
  SKIP_NODE,
  
  // Backwards compatibility - map old names to new states
  RUNNING: NodeState.Recomputing, // Will be deprecated - use CHECKING or RECOMPUTING
};

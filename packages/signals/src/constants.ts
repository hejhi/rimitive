export const CONSTANTS = {
  RUNNING: 1 << 2,      // 4  - Currently executing
  DISPOSED: 1 << 3,     // 8  - Node has been disposed
  OUTDATED: 1 << 1,     // 2  - Definitely needs recomputation
  NOTIFIED: 1 << 0,     // 1  - Possibly needs recomputation
  IS_COMPUTED: 1 << 5,  // 32 - Node is a computed (vs effect)
  TRACKING: 1 << 4,     // 16 - Computed has active dependents
  SKIP_EQUALITY: 1 << 6 // 64 - Skip equality check (for subscribe)
}

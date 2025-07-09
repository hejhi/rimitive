import type { Signal } from '@lattice/signals';

export interface Snapshot {
  id: string;
  timestamp: number;
  contextId: string;
  signals: Map<string, any>; // signalId -> value
  transactionIndex: number;
}

export interface TimeTravelState {
  snapshots: Snapshot[];
  currentIndex: number;
  isTimeTraveling: boolean;
  suppressEffects: boolean;
}

class TimeTravelManager {
  private state: TimeTravelState = {
    snapshots: [],
    currentIndex: -1,
    isTimeTraveling: false,
    suppressEffects: true,
  };

  private signalRefs = new Map<string, Signal<any>>(); // signalId -> Signal
  private originalEffectRunner: ((fn: () => void) => void) | null = null;

  registerSignal(signalId: string, signal: Signal<any>) {
    this.signalRefs.set(signalId, signal);
  }

  unregisterSignal(signalId: string) {
    this.signalRefs.delete(signalId);
  }

  captureSnapshot(contextId: string, transactionIndex: number): Snapshot {
    const signals = new Map<string, any>();
    
    // Capture all signal values
    for (const [signalId, signal] of this.signalRefs) {
      try {
        signals.set(signalId, signal.value);
      } catch (e) {
        // Signal might be disposed
        console.warn(`Failed to capture signal ${signalId}:`, e);
      }
    }

    const snapshot: Snapshot = {
      id: `snapshot_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      contextId,
      signals,
      transactionIndex,
    };

    return snapshot;
  }

  addSnapshot(snapshot: Snapshot) {
    // If we're in the middle of the timeline, remove future snapshots
    if (this.state.currentIndex < this.state.snapshots.length - 1) {
      this.state.snapshots = this.state.snapshots.slice(0, this.state.currentIndex + 1);
    }

    this.state.snapshots.push(snapshot);
    this.state.currentIndex = this.state.snapshots.length - 1;

    // Keep snapshot history limited
    if (this.state.snapshots.length > 100) {
      this.state.snapshots = this.state.snapshots.slice(-50);
      this.state.currentIndex = this.state.snapshots.length - 1;
    }
  }

  startTimeTravel() {
    this.state.isTimeTraveling = true;
    
    // Suppress effects during time travel if enabled
    if (this.state.suppressEffects && !this.originalEffectRunner) {
      this.suppressEffectExecution();
    }
  }

  endTimeTravel() {
    this.state.isTimeTraveling = false;
    
    // Restore effect execution
    if (this.originalEffectRunner) {
      this.restoreEffectExecution();
    }
  }

  goToSnapshot(index: number): boolean {
    if (index < 0 || index >= this.state.snapshots.length) {
      return false;
    }

    const snapshot = this.state.snapshots[index];
    if (!snapshot) return false;

    this.startTimeTravel();

    try {
      // Restore all signal values
      for (const [signalId, value] of snapshot.signals) {
        const signal = this.signalRefs.get(signalId);
        if (signal) {
          signal.value = value;
        }
      }

      this.state.currentIndex = index;
      return true;
    } finally {
      this.endTimeTravel();
    }
  }

  goToPreviousSnapshot(): boolean {
    return this.goToSnapshot(this.state.currentIndex - 1);
  }

  goToNextSnapshot(): boolean {
    return this.goToSnapshot(this.state.currentIndex + 1);
  }

  goToLatest(): boolean {
    return this.goToSnapshot(this.state.snapshots.length - 1);
  }

  getState(): TimeTravelState {
    return { ...this.state };
  }

  getSnapshots(): Snapshot[] {
    return [...this.state.snapshots];
  }

  isTimeTraveling(): boolean {
    return this.state.isTimeTraveling;
  }

  setSuppressEffects(suppress: boolean) {
    this.state.suppressEffects = suppress;
  }

  private suppressEffectExecution() {
    // This will be connected to the actual effect system
    // For now, we'll set a flag that the instrumentation can check
    (globalThis as any).__LATTICE_DEVTOOLS_SUPPRESS_EFFECTS__ = true;
  }

  private restoreEffectExecution() {
    (globalThis as any).__LATTICE_DEVTOOLS_SUPPRESS_EFFECTS__ = false;
  }

  clear() {
    this.state.snapshots = [];
    this.state.currentIndex = -1;
    this.state.isTimeTraveling = false;
    this.signalRefs.clear();
  }
}

// Global instance
export const timeTravel = new TimeTravelManager();

// Helper to check if effects should be suppressed
export function shouldSuppressEffects(): boolean {
  return !!(globalThis as any).__LATTICE_DEVTOOLS_SUPPRESS_EFFECTS__;
}
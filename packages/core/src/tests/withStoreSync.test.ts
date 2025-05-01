import { describe, it, expect, vi } from 'vitest';
import { create, StoreApi } from 'zustand';
import { withStoreSync } from '../index';
import { StoreStateSelector } from '../types';

// Define types for our test stores
type SourceState = { value: string };
type SyncedState = { syncedValue: string };
type BaseTargetState = SyncedState;
type TargetState = BaseTargetState & { _syncCleanup: () => void };

type TestStores = {
  sourceStore: StoreApi<SourceState>;
};

describe('withStoreSync middleware', () => {
  it('should synchronize state from source stores to target store', () => {
    // Create source stores
    const counterStore = create(() => ({
      count: 0,
      increment: () =>
        counterStore.setState((state) => ({ count: state.count + 1 })),
    }));

    const userStore = create(() => ({
      name: 'John',
      setName: (name: string) => userStore.setState({ name }),
    }));

    // Create target store with withStoreSync middleware
    const targetStore = create(
      withStoreSync(
        { counterStore, userStore },
        ({ counterStore, userStore }) => ({
          syncedCount: counterStore.count,
          syncedName: userStore.name,
        })
      )(() => ({
        extraState: 'initial',
        // Add any other state or methods needed
      }))
    );

    // Verify initial state synchronization
    const initialState = targetStore.getState();
    expect(initialState).toHaveProperty('syncedCount', 0);
    expect(initialState).toHaveProperty('syncedName', 'John');
    expect(initialState).toHaveProperty('extraState', 'initial');

    // Update source store and verify target store updates
    counterStore.getState().increment();
    const stateAfterIncrement = targetStore.getState();
    expect(stateAfterIncrement).toHaveProperty('syncedCount', 1);

    // Update another source store
    userStore.setState({ name: 'Alice' });
    const stateAfterNameChange = targetStore.getState();
    expect(stateAfterNameChange).toHaveProperty('syncedName', 'Alice');
  });

  it('should properly handle source store changes and cleanup', () => {
    // Create source store with a mock unsubscribe function
    const unsubscribe = vi.fn();
    const sourceStore = create<SourceState>(() => ({ value: 'initial' }));
    vi.spyOn(sourceStore, 'subscribe').mockReturnValue(unsubscribe);

    // Define selector
    const selector: StoreStateSelector<TestStores, SyncedState> = ({
      sourceStore,
    }) => ({
      syncedValue: sourceStore.value,
    });

    // Create target store with withStoreSync middleware
    const targetStore = create<TargetState>(
      withStoreSync<TestStores, SyncedState, BaseTargetState>(
        { sourceStore },
        selector
      )(() => ({
        syncedValue: sourceStore.getState().value,
      }))
    );

    // Verify subscribe was called on the source store
    expect(sourceStore.subscribe).toHaveBeenCalled();

    // Get the cleanup function
    const cleanup = targetStore.getState()._syncCleanup;
    expect(typeof cleanup).toBe('function');

    // Call cleanup and verify unsubscribe was called
    cleanup();
    expect(unsubscribe).toHaveBeenCalled();

    // Verify unsubscribe is called exactly once per source store
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

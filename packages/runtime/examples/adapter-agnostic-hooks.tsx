/**
 * Example: Adapter-agnostic React hooks
 *
 * This example shows that the React hooks from @lattice/runtime
 * work with any Lattice adapter, not just Zustand.
 */

import React from 'react';
import { CreateStore } from '@lattice/core';
import { useSliceSelector, useSliceValues } from '@lattice/runtime';

// Example app that works with any adapter
const createApp = (
  createStore: CreateStore<{
    count: number;
    user: { name: string; role: string };
  }>
) => {
  const createSlice = createStore({
    count: 0,
    user: { name: 'Guest', role: 'visitor' },
  });

  const counter = createSlice(({ get, set }) => ({
    value: () => get().count,
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
  }));

  const user = createSlice(({ get, set }) => ({
    profile: () => get().user,
    name: () => get().user.name,
    role: () => get().user.role,
    login: (name: string, role: string) => set({ user: { name, role } }),
    logout: () => set({ user: { name: 'Guest', role: 'visitor' } }),
  }));

  return { counter, user };
};

// Component that works with any adapter
function UniversalCounter<
  T extends ReturnType<typeof createApp> & { subscribe: any },
>({ store }: { store: T }) {
  // These hooks work regardless of which adapter created the store
  const count = useSliceSelector(store, (s) => s.counter.value());

  return (
    <div>
      <h3>Universal Counter: {count}</h3>
      <button onClick={() => store.counter.increment()}>+</button>
      <button onClick={() => store.counter.decrement()}>-</button>
    </div>
  );
}

// Another component showing multiple values
function UserInfo<T extends ReturnType<typeof createApp> & { subscribe: any }>({
  store,
}: {
  store: T;
}) {
  // useSliceValues with shallow equality works with any adapter
  const { name, role } = useSliceValues(store, (s) => ({
    name: s.user.name(),
    role: s.user.role(),
  }));

  return (
    <div>
      <h3>
        User: {name} ({role})
      </h3>
      <button onClick={() => store.user.login('Alice', 'admin')}>
        Login as Alice
      </button>
      <button onClick={() => store.user.logout()}>Logout</button>
    </div>
  );
}

// Example usage with different adapters
export function App() {
  // In real usage, you'd use actual adapters:
  // const zustandStore = createZustandAdapter(createApp);
  // const reduxStore = createReduxAdapter(createApp);
  // const jotaiStore = createJotaiAdapter(createApp);

  // For this example, we'll simulate stores from different adapters
  const mockStore = (() => {
    const app = createApp((initialState) => {
      let state = initialState;
      return (factory) =>
        factory({
          get: () => state,
          set: (updates) => {
            state = { ...state, ...updates };
          },
        });
    });

    return {
      ...app,
      subscribe: (_listener: () => void) => {
        // Mock subscription
        return () => {};
      },
    };
  })();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Adapter-Agnostic React Hooks</h1>
      <p>
        The React hooks from @lattice/runtime work with any Lattice adapter.
        They only require that the store has a subscribe method and slices.
      </p>

      <UniversalCounter store={mockStore} />
      <hr />
      <UserInfo store={mockStore} />

      <div style={{ marginTop: '2rem', fontSize: '0.9em', color: '#666' }}>
        <p>These same components would work identically with:</p>
        <ul>
          <li>createZustandAdapter(createApp)</li>
          <li>createReduxAdapter(createApp)</li>
          <li>createJotaiAdapter(createApp)</li>
          <li>createValtioAdapter(createApp)</li>
          <li>...or any other Lattice adapter</li>
        </ul>
      </div>
    </div>
  );
}

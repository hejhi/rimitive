/**
 * @fileoverview Basic API Parameter Usage Examples
 *
 * This example demonstrates the fundamental usage patterns for the API
 * parameter in Lattice slices.
 */

import React from 'react';
import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews, useActions } from '@lattice/adapter-zustand/react';

// ============================================================================
// Basic API Usage Example
// ============================================================================
export const apiBasicsComponent = createComponent(() => {
  const model = createModel<{
    count: number;
    message: string;
    history: string[];

    increment: () => void;
    decrement: () => void;
    updateMessage: (msg: string) => void;
    reset: () => void;
  }>(({ set, get }) => ({
    count: 0,
    message: 'Hello, API!',
    history: [],

    increment: () => {
      const newCount = get().count + 1;
      set({
        count: newCount,
        history: [...get().history, `Incremented to ${newCount}`],
      });
    },

    decrement: () => {
      const newCount = get().count - 1;
      set({
        count: newCount,
        history: [...get().history, `Decremented to ${newCount}`],
      });
    },

    updateMessage: (msg) => {
      set({
        message: msg,
        history: [...get().history, `Message updated to: ${msg}`],
      });
    },

    reset: () => {
      set({
        count: 0,
        message: 'Hello, API!',
        history: ['Reset performed'],
      });
    },
  }));

  // Basic slice - no API usage
  const stateSlice = createSlice(model, (m) => ({
    count: m.count,
    message: m.message,
  }));

  // Slice using getState from API
  const debugSlice = createSlice(model, (m, api) => {
    const state = api.getState();
    return {
      modelCount: m.count,
      apiCount: state.count,
      statesMatch: m.count === state.count,
      fullState: state,
    };
  });

  // Slice using executeSlice to compose data
  const summarySlice = createSlice(model, (_m, api) => {
    const basicState = api.executeSlice(stateSlice);
    const debugInfo = api.executeSlice(debugSlice);

    return {
      summary: `Count: ${basicState.count}, Message: "${basicState.message}"`,
      isDebugging: debugInfo.statesMatch,
      historyLength: api.getState().history.length,
    };
  });

  // Actions with API usage for logging
  const actions = createSlice(model, (m, api) => ({
    increment: () => {
      console.log('[API] Before increment:', api.getState().count);
      m.increment();
      // Note: State won't be updated until after this function returns
    },

    decrement: () => {
      console.log('[API] Before decrement:', api.getState().count);
      m.decrement();
    },

    updateMessage: (msg: string) => {
      const oldMessage = api.getState().message;
      console.log('[API] Message change:', oldMessage, '→', msg);
      m.updateMessage(msg);
    },

    reset: () => {
      const summary = api.executeSlice(summarySlice);
      console.log('[API] Resetting from state:', summary.summary);
      m.reset();
    },
  }));

  // History slice with filtering
  const historySlice = createSlice(model, (m) => ({
    allHistory: m.history,
    recentHistory: m.history.slice(-5),
    historyWithTimestamps: m.history.map((entry, index) => ({
      id: index,
      message: entry,
      timestamp: new Date().toISOString(),
    })),
    stats: {
      totalActions: m.history.length,
      incrementCount: m.history.filter((h) => h.includes('Incremented')).length,
      decrementCount: m.history.filter((h) => h.includes('Decremented')).length,
    },
  }));

  return {
    model,
    actions,
    views: {
      state: stateSlice,
      debug: debugSlice,
      summary: summarySlice,
      history: historySlice,
    },
  };
});

// ============================================================================
// Create Store
// ============================================================================
const apiBasicsStore = createZustandAdapter(apiBasicsComponent);

// ============================================================================
// React Components
// ============================================================================
function StateDisplay() {
  const state = useViews(apiBasicsStore, (views) => views.state());

  return (
    <div
      style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}
    >
      <h3>Current State</h3>
      <p>Count: {state.count}</p>
      <p>Message: {state.message}</p>
    </div>
  );
}

function DebugInfo() {
  const debug = useViews(apiBasicsStore, (views) => views.debug());

  return (
    <div
      style={{ background: '#e0e0ff', padding: '10px', borderRadius: '5px' }}
    >
      <h3>Debug Information</h3>
      <p>Model Count: {debug.modelCount}</p>
      <p>API Count: {debug.apiCount}</p>
      <p>States Match: {debug.statesMatch ? '✅' : '❌'}</p>
      <details>
        <summary>Full State</summary>
        <pre style={{ fontSize: '0.8em' }}>
          {JSON.stringify(debug.fullState, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Summary() {
  const summary = useViews(apiBasicsStore, (views) => views.summary());

  return (
    <div
      style={{ background: '#ffe0e0', padding: '10px', borderRadius: '5px' }}
    >
      <h3>Summary (Composed)</h3>
      <p>{summary.summary}</p>
      <p>History Length: {summary.historyLength}</p>
    </div>
  );
}

function History() {
  const history = useViews(apiBasicsStore, (views) => views.history());

  return (
    <div
      style={{ background: '#e0ffe0', padding: '10px', borderRadius: '5px' }}
    >
      <h3>Action History</h3>
      <p>Total Actions: {history.stats.totalActions}</p>
      <p>
        Increments: {history.stats.incrementCount} | Decrements:{' '}
        {history.stats.decrementCount}
      </p>

      <h4>Recent History (last 5)</h4>
      <ul style={{ fontSize: '0.9em' }}>
        {history.recentHistory.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

function Controls() {
  const actions = useActions(apiBasicsStore);
  const [message, setMessage] = React.useState('');

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Controls</h3>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => actions.increment()}>Increment</button>
        <button
          onClick={() => actions.decrement()}
          style={{ marginLeft: '5px' }}
        >
          Decrement
        </button>
        <button onClick={() => actions.reset()} style={{ marginLeft: '10px' }}>
          Reset
        </button>
      </div>

      <div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter new message"
        />
        <button
          onClick={() => {
            if (message.trim()) {
              actions.updateMessage(message);
              setMessage('');
            }
          }}
          style={{ marginLeft: '5px' }}
        >
          Update Message
        </button>
      </div>
    </div>
  );
}

export function APIBasicsExample() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>API Parameter - Basic Usage</h1>

      <p style={{ marginBottom: '20px' }}>
        This example demonstrates the fundamental API parameter features:
        <code>getState()</code> and <code>executeSlice()</code>. Open the
        console to see logging output.
      </p>

      <Controls />

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}
      >
        <StateDisplay />
        <DebugInfo />
        <Summary />
        <History />
      </div>

      <div
        style={{
          marginTop: '30px',
          padding: '15px',
          background: '#fffaf0',
          borderRadius: '5px',
        }}
      >
        <h3>Key Concepts Demonstrated:</h3>
        <ul>
          <li>
            <strong>getState():</strong> Access the current model state from any
            slice
          </li>
          <li>
            <strong>executeSlice():</strong> Execute other slices to compose
            their results
          </li>
          <li>
            <strong>Logging:</strong> Use API in actions to log state before
            mutations
          </li>
          <li>
            <strong>Composition:</strong> Build complex views by combining
            simpler slices
          </li>
          <li>
            <strong>Debugging:</strong> Compare model parameter vs API state
            access
          </li>
        </ul>
      </div>
    </div>
  );
}

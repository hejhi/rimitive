import { useEffect } from 'react';
import {
  devtoolsStore,
  handleDevToolsMessage,
  filteredTransactions,
  stats,
  type DevToolsMessage,
  type SignalReadData,
  type SignalWriteData,
  type SignalCreatedData,
  type NamedItemData,
} from './store';
import { useSignal } from './useLattice';
import './App.css';

export function App() {
  console.log('[DevTools Panel] App component rendering');

  // Use Lattice signals with React
  const connected = useSignal(devtoolsStore.state.connected);
  const contexts = useSignal(devtoolsStore.state.contexts);
  const selectedTab = useSignal(devtoolsStore.state.selectedTab);
  const transactions = useSignal(filteredTransactions);
  const statsData = useSignal(stats);

  console.log('[DevTools Panel] Connected state:', connected);

  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    let timeoutId: number | null = null;

    // Connect to background script
    port = chrome.runtime.connect({ name: 'devtools-panel' });

    // Get the inspected window tab ID
    const tabId = chrome.devtools.inspectedWindow.tabId;
    console.log('[DevTools Panel] Connecting for tab:', tabId);

    // Send init message with tab ID
    port.postMessage({
      type: 'INIT',
      tabId: tabId,
    });

    const messageHandler = (message: DevToolsMessage) => {
      console.log('[DevTools Panel] Received:', message);
      if (message && typeof message === 'object' && 'type' in message) {
        handleDevToolsMessage(message);
      }
    };

    port.onMessage.addListener(messageHandler);

    // Handle disconnect
    port.onDisconnect.addListener(() => {
      console.log('[DevTools Panel] Port disconnected');
    });

    // Request initial state after a short delay
    timeoutId = window.setTimeout(() => {
      if (port) {
        try {
          port.postMessage({
            type: 'GET_STATE',
            tabId: tabId,
          });
        } catch (e) {
          console.error('[DevTools Panel] Error sending GET_STATE:', e);
        }
      }
    }, 100);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (port) {
        port.disconnect();
      }
    };
  }, []);

  if (!connected) {
    return (
      <div className="no-lattice">
        <div className="no-lattice-content">
          <h2>Lattice Not Detected</h2>
          <p>This page doesn't appear to be using Lattice DevTools.</p>
          <p>Make sure to:</p>
          <ul>
            <li>
              Import <code>@lattice/devtools</code> in your application
            </li>
            <li>
              Call <code>enableDevTools()</code> before creating any contexts
            </li>
            <li>
              Use <code>createLattice</code> and <code>createStore</code> from{' '}
              <code>@lattice/devtools</code>
            </li>
            <li>Refresh the page after enabling DevTools</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Lattice DevTools</h1>
        <div className="stats">
          <span>Contexts: {contexts.length}</span>
          <span>Signals: {statsData.totalSignals}</span>
          <span>Computed: {statsData.totalComputeds}</span>
          <span>Effects: {statsData.totalEffects}</span>
        </div>
      </div>

      <div className="tabs">
        <button
          className={selectedTab === 'timeline' ? 'active' : ''}
          onClick={() => (devtoolsStore.state.selectedTab.value = 'timeline')}
        >
          Timeline
        </button>
      </div>

      <div className="content">
        {selectedTab === 'timeline' && (
          <div className="timeline">
            <div className="timeline-header">
              <h2>Transaction Timeline</h2>
              <div className="timeline-controls">
                <select
                  value={devtoolsStore.state.filter.value.type}
                  onChange={(e) =>
                    devtoolsStore.set({
                      filter: {
                        ...devtoolsStore.state.filter.value,
                        type: e.target.value as
                          | 'all'
                          | 'signal'
                          | 'computed'
                          | 'effect',
                      },
                    })
                  }
                >
                  <option value="all">All</option>
                  <option value="signal">Signals</option>
                  <option value="computed">Computed</option>
                  <option value="effect">Effects</option>
                </select>
                <input
                  type="text"
                  placeholder="Search..."
                  value={devtoolsStore.state.filter.value.search}
                  onChange={(e) =>
                    devtoolsStore.set({
                      filter: {
                        ...devtoolsStore.state.filter.value,
                        search: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="transaction-list">
              {transactions.map((tx) => (
                <div key={tx.id} className={`transaction ${tx.type}`}>
                  <span className="time">
                    {tx.timestamp
                      ? new Date(tx.timestamp).toLocaleTimeString()
                      : 'N/A'}
                  </span>
                  <span className="type">{tx.eventType}</span>
                  <span className="data">
                    {(() => {
                      if (tx.eventType === 'SIGNAL_READ') {
                        const data = tx.data as SignalReadData;
                        const signalName = data.name || data.id;
                        return (
                          <>
                            {signalName}: {JSON.stringify(data.value)}
                            {data.internal && (
                              <span className="internal">
                                {' '}
                                [internal: {data.internal}]
                              </span>
                            )}
                            {data.readContext && (
                              <span className="context">
                                {' '}
                                [{data.readContext.type}:{' '}
                                {data.readContext.name || data.readContext.id}]
                              </span>
                            )}
                          </>
                        );
                      } else if (tx.eventType === 'SIGNAL_WRITE') {
                        const data = tx.data as SignalWriteData;
                        const signalName = data.name || data.id;
                        return (
                          <>
                            {signalName}: {JSON.stringify(data.oldValue)} →{' '}
                            {JSON.stringify(data.newValue)}
                          </>
                        );
                      } else if (tx.eventType === 'SIGNAL_CREATED') {
                        const data = tx.data as SignalCreatedData;
                        const signalName = data.name || data.id;
                        return `${signalName} = ${JSON.stringify(data.initialValue)}`;
                      } else if (
                        tx.eventType === 'COMPUTED_CREATED' ||
                        tx.eventType === 'EFFECT_CREATED'
                      ) {
                        const data = tx.data as NamedItemData;
                        return data.name || data.id;
                      } else {
                        return JSON.stringify(tx.data);
                      }
                    })()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

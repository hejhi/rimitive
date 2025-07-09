import { useEffect } from 'react';
import {
  devtoolsStore,
  handleDevToolsMessage,
  filteredTransactions,
  selectedContextData,
  stats,
} from './store';
import { useSignal } from './useLattice';
import './App.css';

export function App() {
  console.log('[DevTools Panel] App component rendering');

  // Use Lattice signals with React
  const connected = useSignal(devtoolsStore.state.connected);
  const contexts = useSignal(devtoolsStore.state.contexts);
  const selectedTab = useSignal(devtoolsStore.state.selectedTab);
  const selectedContext = useSignal(devtoolsStore.state.selectedContext);
  const transactions = useSignal(filteredTransactions);
  const contextData = useSignal(selectedContextData);
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

    const messageHandler = (message: any) => {
      console.log('[DevTools Panel] Received:', message);
      handleDevToolsMessage(message);
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
        <button
          className={selectedTab === 'graph' ? 'active' : ''}
          onClick={() => (devtoolsStore.state.selectedTab.value = 'graph')}
        >
          Reactive Graph
        </button>
        <button
          className={selectedTab === 'inspector' ? 'active' : ''}
          onClick={() => (devtoolsStore.state.selectedTab.value = 'inspector')}
        >
          Inspector
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
                        type: e.target.value as any,
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
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={devtoolsStore.state.filter.value.hideInternal}
                    onChange={(e) =>
                      devtoolsStore.set({
                        filter: {
                          ...devtoolsStore.state.filter.value,
                          hideInternal: e.target.checked,
                        },
                      })
                    }
                  />
                  Hide Internal
                </label>
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
                      if (tx.eventType === 'SIGNAL_READ' || tx.eventType === 'SIGNAL_WRITE') {
                        const signalName = tx.data.name || tx.data.id;
                        if (tx.eventType === 'SIGNAL_READ') {
                          return (
                            <>
                              {signalName}: {JSON.stringify(tx.data.value)}
                              {tx.data.internal && (
                                <span className="internal">
                                  {' '}
                                  [internal: {tx.data.internal}]
                                </span>
                              )}
                              {tx.data.readContext && (
                                <span className="context">
                                  {' '}
                                  [{tx.data.readContext.type}:{' '}
                                  {tx.data.readContext.name || tx.data.readContext.id}
                                  ]
                                </span>
                              )}
                            </>
                          );
                        } else {
                          return (
                            <>
                              {signalName}: {JSON.stringify(tx.data.oldValue)} → {JSON.stringify(tx.data.newValue)}
                            </>
                          );
                        }
                      } else if (tx.eventType === 'SIGNAL_CREATED') {
                        const signalName = tx.data.name || tx.data.id;
                        return `${signalName} = ${JSON.stringify(tx.data.initialValue)}`;
                      } else if (tx.eventType === 'COMPUTED_CREATED' || tx.eventType === 'EFFECT_CREATED') {
                        return tx.data.name || tx.data.id;
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

        {selectedTab === 'graph' && (
          <div className="graph">
            <h2>Reactive Dependency Graph</h2>
            <p>Interactive dependency visualization coming soon...</p>
            <p>Will show:</p>
            <ul>
              <li>Signal → Computed dependencies</li>
              <li>Computed → Effect relationships</li>
              <li>Update propagation paths</li>
              <li>Circular dependency detection</li>
            </ul>
          </div>
        )}

        {selectedTab === 'inspector' && (
          <div className="inspector">
            <div className="inspector-sidebar">
              <h2>Contexts</h2>
              <div className="context-list">
                {contexts.map((ctx) => (
                  <div
                    key={ctx.id}
                    className={`context ${selectedContext === ctx.id ? 'selected' : ''}`}
                    onClick={() =>
                      (devtoolsStore.state.selectedContext.value = ctx.id)
                    }
                  >
                    <h3>{ctx.name}</h3>
                    <div className="context-stats">
                      <span>📊 {ctx.signalCount}</span>
                      <span>🔄 {ctx.computedCount}</span>
                      <span>⚡ {ctx.effectCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {contextData && (
              <div className="inspector-main">
                <h2>{contextData.name} Details</h2>

                <div className="inspector-section">
                  <h3>Signals ({contextData.signals.length})</h3>
                  <div className="reactive-list">
                    {contextData.signals.map((signal) => (
                      <div key={signal.id} className="reactive-item signal">
                        <span className="name">{signal.name || signal.id}</span>
                        <span className="value">
                          {JSON.stringify(signal.value)}
                        </span>
                        <span className="updated">
                          {signal.lastUpdated
                            ? new Date(signal.lastUpdated).toLocaleTimeString()
                            : 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="inspector-section">
                  <h3>Computed ({contextData.computeds.length})</h3>
                  <div className="reactive-list">
                    {contextData.computeds.map((computed) => (
                      <div key={computed.id} className="reactive-item computed">
                        <span className="name">
                          {computed.name || computed.id}
                        </span>
                        <span className="value">
                          {JSON.stringify(computed.value)}
                        </span>
                        <span className="deps">
                          {computed.dependencies.length} deps
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="inspector-section">
                  <h3>Effects ({contextData.effects.length})</h3>
                  <div className="reactive-list">
                    {contextData.effects.map((effect) => (
                      <div key={effect.id} className="reactive-item effect">
                        <span className="name">{effect.name || effect.id}</span>
                        <span
                          className={`status ${effect.isActive ? 'active' : 'inactive'}`}
                        >
                          {effect.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {effect.lastRun > 0 && (
                          <span className="updated">
                            {new Date(effect.lastRun).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

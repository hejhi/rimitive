interface DevToolsMessage {
  type: string;
  tabId?: number;
  payload?: unknown;
  data?: unknown;
}

interface LatticeEvent {
  type: string;
  contextId?: string;
  data?: {
    name?: string;
  };
  contexts?: Array<{
    id: string;
    name: string;
    signalCount: number;
    computedCount: number;
    effectCount: number;
  }>;
}

interface TabState {
  connected: boolean;
  contexts: Array<{
    id: string;
    name: string;
    signalCount: number;
    computedCount: number;
    effectCount: number;
  }>;
  transactions: unknown[];
  selectedContext: string | null;
}

export default defineBackground(() => {
  console.log('[Background] Background script initializing');
  
  // Store connections from devtools panels
  const devtoolsConnections = new Map<number, chrome.runtime.Port>();
  
  // Store Lattice state per tab
  const tabStates = new Map<number, TabState>();
  
  // Listen for connections from devtools panels
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'devtools-panel') {
      // DevTools panels don't have a tab ID in sender, we need to get it from the message
      let tabId: number | undefined;
      
      port.onMessage.addListener((msg: DevToolsMessage) => {
        console.log('[Background] DevTools panel message:', msg);
        
        if (msg.type === 'INIT' && msg.tabId) {
          tabId = msg.tabId;
          console.log('[Background] DevTools panel connected for tab:', tabId);
          devtoolsConnections.set(tabId, port);
        
          // Send current state if we have it
          if (tabStates.has(tabId)) {
            const state = tabStates.get(tabId);
            console.log('[Background] Sending initial state to DevTools:', state);
            port.postMessage({
              type: 'STATE_UPDATE',
              data: state,
            });
            
            // Also send LATTICE_DETECTED if it was already detected
            if (state.connected) {
              port.postMessage({
                type: 'LATTICE_DETECTED',
                data: { enabled: true }
              });
            }
          }
        } else if (msg.type === 'GET_STATE') {
          // Use the tabId from the message if not already set
          if (!tabId && msg.tabId) {
            tabId = msg.tabId;
          }
          
          console.log('[Background] GET_STATE request for tab:', tabId);
          console.log('[Background] Available tab states:', Array.from(tabStates.keys()));
          
          // Send current state
          if (tabId && tabStates.has(tabId)) {
            const state = tabStates.get(tabId);
            console.log('[Background] Sending state:', state);
            port.postMessage({
              type: 'STATE_UPDATE',
              data: state,
            });
            
            // Also send LATTICE_DETECTED if it was already detected
            if (state.connected) {
              port.postMessage({
                type: 'LATTICE_DETECTED',
                data: { enabled: true }
              });
            }
          } else {
            console.log('[Background] No state found for tab:', tabId);
          }
        }
      });
      
      // Clean up on disconnect
      port.onDisconnect.addListener(() => {
        if (tabId) {
          devtoolsConnections.delete(tabId);
        }
      });
    }
  });
  
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message: { source?: string; type?: string; payload?: unknown }, sender) => {
    console.log('[Background] onMessage listener received:', message, 'from tab:', sender.tab?.id, 'sender:', sender);
    
    const tabId = sender.tab?.id;
    if (!tabId) {
      console.log('[Background] No tab ID, ignoring message');
      return;
    }
    
    if (message.source === 'lattice-devtools' || message.source === 'lattice-devtools-content') {
      console.log('[Background] Processing Lattice message:', message.type);
      
      // Handle messages from the page
      switch (message.type) {
        case 'LATTICE_DETECTED': {
          console.log('[Background] Lattice detected in tab:', tabId);
          // Initialize state for this tab
          if (!tabStates.has(tabId)) {
            tabStates.set(tabId, {
              connected: true,
              contexts: [],
              transactions: [],
              selectedContext: null,
            });
            console.log('[Background] Created new state for tab:', tabId);
          } else {
            // Update existing state
            const state = tabStates.get(tabId)!;
            state.connected = true;
            tabStates.set(tabId, state);
            console.log('[Background] Updated existing state for tab:', tabId);
          }
          
          console.log('[Background] Current tab states after LATTICE_DETECTED:', Array.from(tabStates.keys()));
          
          // Forward to devtools if connected
          const port = devtoolsConnections.get(tabId);
          console.log('[Background] DevTools port for tab', tabId, ':', port ? 'connected' : 'not connected');
          console.log('[Background] All connections:', Array.from(devtoolsConnections.keys()));
          
          if (port) {
            console.log('[Background] Forwarding LATTICE_DETECTED to devtools');
            port.postMessage({
              type: 'LATTICE_DETECTED',
              data: message.payload
            });
          }
          break;
        }
          
        case 'EVENT': {
          // Handle Lattice events
          const currentState = tabStates.get(tabId) || {
            connected: true,
            contexts: [],
            transactions: [],
            selectedContext: null,
          };
          
          // Update state based on event
          const event = message.payload as LatticeEvent;
          
          if (event.type === 'CONTEXTS_UPDATE' && event.contexts) {
            // Handle the initial contexts update
            console.log('[Background] Updating contexts for tab:', tabId, event.contexts);
            currentState.contexts = event.contexts;
            tabStates.set(tabId, currentState);
            
            // Forward to devtools if connected
            const port = devtoolsConnections.get(tabId);
            if (port) {
              port.postMessage({
                type: 'STATE_UPDATE',
                data: currentState,
              });
            }
          } else if (event.type === 'CONTEXT_CREATED') {
            currentState.contexts.push({
              id: event.contextId,
              name: event.data?.name || `Context ${event.contextId}`,
              signalCount: 0,
              computedCount: 0,
              effectCount: 0,
            });
          } else if (event.type === 'SIGNAL_CREATED') {
            const context = currentState.contexts.find((c) => c.id === event.contextId);
            if (context) {
              context.signalCount++;
            }
          }
          // ... handle other event types
          
          // Save state
          tabStates.set(tabId, currentState);
          
          // Forward to devtools
          const devtoolsPort = devtoolsConnections.get(tabId);
          if (devtoolsPort) {
            devtoolsPort.postMessage({
              type: 'TRANSACTION',
              data: event,
            });
          }
          break;
        }
      }
    }
  });
  
  // Clean up tab states when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
    devtoolsConnections.delete(tabId);
  });
});
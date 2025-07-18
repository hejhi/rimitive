interface DevToolsMessage {
  type: string;
  tabId?: number;
  payload?: unknown;
  data?: unknown;
}

interface LatticeEvent {
  type: string;
  contextId?: string;
  timestamp?: number;
  data?: {
    name?: string;
    id?: string;
    dependencies?: Array<{ id: string; name?: string }>;
    subscribers?: Array<{ id: string; name?: string }>;
    nodes?: Array<{
      id: string;
      type: 'signal' | 'computed' | 'effect';
      name?: string;
      value?: unknown;
      isActive: boolean;
      isOutdated?: boolean;
      hasSubscribers?: boolean;
    }>;
    edges?: Array<{
      source: string;
      target: string;
      isActive: boolean;
    }>;
  };
  contexts?: Array<{
    id: string;
    name: string;
    signalCount: number;
    computedCount: number;
    effectCount: number;
  }>;
}

export default defineBackground(() => {
  // Store connections from devtools panels
  const devtoolsConnections = new Map<number, chrome.runtime.Port>();

  // Just track which tabs have Lattice detected (no state storage)
  const latticeDetectedTabs = new Set<number>();

  // Listen for connections from devtools panels
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'devtools-panel') {
      // DevTools panels don't have a tab ID in sender, we need to get it from the message
      let tabId: number | undefined;

      port.onMessage.addListener((msg: DevToolsMessage) => {
        if (msg.type === 'INIT' && msg.tabId) {
          tabId = msg.tabId;
          devtoolsConnections.set(tabId, port);

          // If Lattice was detected, notify the panel
          if (latticeDetectedTabs.has(tabId)) {
            port.postMessage({
              type: 'LATTICE_DETECTED',
              data: { enabled: true },
            });

            // Request fresh state from the page
            void chrome.tabs.sendMessage(tabId, {
              type: 'REQUEST_STATE',
              source: 'lattice-devtools-background'
            });
          }
        } else if (msg.type === 'GET_STATE' && msg.tabId) {
          // Request fresh state from the page
          void chrome.tabs.sendMessage(msg.tabId, {
            type: 'REQUEST_STATE',
            source: 'lattice-devtools-background'
          });
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
  chrome.runtime.onMessage.addListener(
    (
      message: { source?: string; type?: string; payload?: unknown },
      sender
    ) => {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      if (
        message.source === 'lattice-devtools' ||
        message.source === 'lattice-devtools-content'
      ) {
        // Handle messages from the page
        switch (message.type) {
          case 'LATTICE_DETECTED': {
            // Just track that Lattice is detected
            latticeDetectedTabs.add(tabId);

            // Forward to devtools if connected
            const port = devtoolsConnections.get(tabId);

            if (port) {
              port.postMessage({
                type: 'LATTICE_DETECTED',
                data: message.payload,
              });
            }
            break;
          }

          case 'EVENT': {
            // Just forward events to devtools - no state storage
            const event = message.payload as LatticeEvent;
            const devtoolsPort = devtoolsConnections.get(tabId);
            
            if (devtoolsPort) {
              devtoolsPort.postMessage({
                type: 'TRANSACTION',
                data: event,
              });
            }
            break;
          }

          case 'STATE_RESPONSE': {
            // Forward state response from page to devtools
            const devtoolsPort = devtoolsConnections.get(tabId);
            if (devtoolsPort) {
              devtoolsPort.postMessage({
                type: 'STATE_UPDATE',
                data: message.payload,
              });
            }
            break;
          }
        }
      }
    }
  );

  // Clean up when tabs are closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    latticeDetectedTabs.delete(tabId);
    devtoolsConnections.delete(tabId);
  });

  // Clear detection on navigation
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
      latticeDetectedTabs.delete(details.tabId);
    }
  });
});

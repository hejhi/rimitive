type DevToolsMessage = {
  type: string;
  tabId?: number;
  payload?: unknown;
};

type RimitiveDetectionInfo = {
  enabled: boolean;
  version?: string;
  contextId?: string;
  contextName?: string;
};

export default defineBackground(() => {
  // Store connections from devtools panels
  const devtoolsConnections = new Map<number, chrome.runtime.Port>();

  // Track which tabs have Rimitive detected (with full payload)
  const rimitiveDetectedTabs = new Map<number, RimitiveDetectionInfo>();

  // Listen for connections from devtools panels
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'devtools-panel') {
      let tabId: number | undefined;

      port.onMessage.addListener((msg: DevToolsMessage) => {
        if (msg.type === 'INIT' && msg.tabId) {
          tabId = msg.tabId;
          devtoolsConnections.set(tabId, port);

          // If Rimitive was detected, notify the panel with cached info
          const detectionInfo = rimitiveDetectedTabs.get(tabId);
          if (detectionInfo) {
            port.postMessage({
              type: 'LATTICE_DETECTED',
              data: detectionInfo,
            });
          } else {
            // Request re-detection from the page (in case service worker was restarted)
            chrome.tabs.sendMessage(tabId, {
              source: 'rimitive-devtools-background',
              type: 'REQUEST_DETECTION',
            }).catch(() => {
              // Tab might not have content script, ignore error
            });
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
  chrome.runtime.onMessage.addListener(
    (
      message: { source?: string; type?: string; payload?: unknown },
      sender
    ) => {
      const tabId = sender.tab?.id;
      if (!tabId) return;

      if (
        message.source === 'rimitive-devtools' ||
        message.source === 'rimitive-devtools-content'
      ) {
        // Handle messages from the page
        switch (message.type) {
          case 'LATTICE_DETECTED': {
            // Store full detection info for reconnection
            const payload = message.payload as RimitiveDetectionInfo | undefined;
            rimitiveDetectedTabs.set(tabId, payload ?? { enabled: true });

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
            // Forward events to devtools
            const devtoolsPort = devtoolsConnections.get(tabId);
            if (devtoolsPort) {
              devtoolsPort.postMessage({
                type: 'TRANSACTION',
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
    rimitiveDetectedTabs.delete(tabId);
    devtoolsConnections.delete(tabId);
  });

  // Clear detection on navigation
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) {
      // Main frame only
      rimitiveDetectedTabs.delete(details.tabId);

      // Notify devtools panel about navigation
      const port = devtoolsConnections.get(details.tabId);
      if (port) {
        port.postMessage({
          type: 'NAVIGATION',
          data: { tabId: details.tabId },
        });
      }
    }
  });
});

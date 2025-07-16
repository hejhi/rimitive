export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // Listen for messages from the page
    window.addEventListener('message', (event) => {
      if (
        event.source !== window ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return;
      }

      const data = event.data as Record<string, unknown>;
      if (!('source' in data) || data.source !== 'lattice-devtools') return;

      // Forward to background script
      void chrome.runtime.sendMessage({
        source: 'lattice-devtools-content',
        ...data,
      });
    });

    // Listen for messages from devtools
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') {
        return;
      }

      const msg = message as Record<string, unknown>;
      if ('type' in msg && msg.type === 'FROM_DEVTOOLS') {
        // Forward to page
        const messageData = 'data' in msg ? msg.data : {};
        window.postMessage(
          {
            source: 'lattice-devtools-response',
            ...(typeof messageData === 'object' && messageData !== null
              ? messageData
              : {}),
          },
          '*'
        );
      }
    });
  },
});

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    console.log('[Lattice DevTools Content] Starting...');

    // Use WXT's injectScript to inject the bridge script with proper URL
    try {
      await injectScript('/lattice-bridge.js');
      console.log('[Lattice DevTools Content] Bridge script injected');
    } catch (error) {
      console.error(
        '[Lattice DevTools Content] Failed to inject bridge script:',
        error
      );

      // Fallback: inject the script content directly using a different method
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('lattice-bridge.js');
      script.onload = () => {
        console.log(
          '[Lattice DevTools Content] Bridge script loaded via fallback'
        );
        script.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    }

    // Listen for messages from the page
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') {
        return;
      }

      const data = event.data as Record<string, unknown>;
      if (!('source' in data) || data.source !== 'lattice-devtools') {
        return;
      }

      console.log(
        '[Lattice DevTools Content] Received message from page:',
        data
      );

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

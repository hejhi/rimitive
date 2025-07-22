export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // Inject the DevTools API script into the page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('devtools-api.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    
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
      if (!('source' in data)) return;
      
      // Accept messages from either the page directly or the bridge
      if (data.source !== 'lattice-devtools' && data.source !== 'lattice-devtools-bridge') return;

      // Forward to background script
      void chrome.runtime.sendMessage({
        source: 'lattice-devtools-content',
        ...data,
      });
    });

  },
});

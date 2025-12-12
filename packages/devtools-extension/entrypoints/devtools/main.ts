// This script runs in the devtools page context
// It creates the Rimitive panel in Chrome DevTools

chrome.devtools.panels.create(
  'Rimitive',
  '/icon/128.png',
  '/panel.html',
  (panel) => {
    // Store panel reference for later use
    const windowWithPanel = window as Window & {
      rimitivePanel?: chrome.devtools.panels.ExtensionPanel;
    };
    windowWithPanel.rimitivePanel = panel;
  }
);

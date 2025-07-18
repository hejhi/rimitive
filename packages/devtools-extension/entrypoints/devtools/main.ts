// This script runs in the devtools page context
// It creates the Lattice panel in Chrome DevTools

chrome.devtools.panels.create(
  'Lattice',
  '/icon/128.png',
  '/panel.html',
  (panel) => {
    // Store panel reference for later use
    const windowWithPanel = window as Window & {
      latticePanel?: chrome.devtools.panels.ExtensionPanel;
    };
    windowWithPanel.latticePanel = panel;
  }
);

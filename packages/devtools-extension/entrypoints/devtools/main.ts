// This script runs in the devtools page context
// It creates the Lattice panel in Chrome DevTools

chrome.devtools.panels.create(
  'Lattice',
  '/icon/128.png',
  '/panel.html',
  (panel) => {
    console.log('Lattice DevTools panel created');
    
    // Store panel reference for later use
    (window as any).latticePanel = panel;
  }
);
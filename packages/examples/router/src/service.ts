import { createDOMView } from '@lattice/view/presets/dom';
import { createRouter } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/presets/dom';
import { createSignals } from '@lattice/signals';

const signals = createSignals();
export const domView = createDOMView({ signals });
const domViewSvc = domView();

export const router = createRouter<DOMAdapterConfig>(domViewSvc, {
  initialPath:
    typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '/',
});

// Re-export for components that don't need route context
export const { el, computed, signal, map, match, mount } = domViewSvc;
export const { navigate, currentPath } = router;

/**
 * App-level API for router example
 */
import { createDOMSvc } from '@lattice/view/presets/dom';
import { createRouter } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/presets/dom';

const svc = createDOMSvc();

export const router = createRouter<DOMAdapterConfig>(svc, {
  initialPath:
    typeof window !== 'undefined'
      ? window.location.pathname +
        window.location.search +
        window.location.hash
      : '/',
});

// Re-export for components that don't need route context
export const { el, computed, signal, map, match, mount } = svc;
export const { navigate, currentPath } = router;

/**
 * Instrumented View API
 *
 * Creates and exports the view API with DevTools instrumentation.
 * Provides: el, map, on, signal, computed, effect
 */

import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/helpers/map';
import { On } from '@lattice/view/on';
import { createContext } from '@lattice/view/presets/core';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { instrumentEl, instrumentMap, instrumentOn } from '@lattice/view/devtools';
import { createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import { Effect } from '@lattice/signals/effect';
import { Signal } from '@lattice/signals/signal';

export function createViewApi() {
  // Create view context
  const renderer = createDOMRenderer();
  const viewCtx = createContext<HTMLElement>({
    renderer,
    deps: {
      signal: Signal(),
      effect: Effect(),
    }
  });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  // Create view extensions with instrumentation
  const viewExtensions = {
    el: El({ instrument: instrumentEl }),
    map: Map({ instrument: instrumentMap }),
    on: On({ instrument: instrumentOn }),
  };

  return {
    ...signalsApi,
    ...createApi(viewExtensions, { ...viewCtx, instrumentation })
  };
}

/**
 * Mount a component to the DOM using the instrumented view API
 */
export function mount(selector: string, component: any) {
  const viewApi = createViewApi();
  const nodeRef = component.create(viewApi);
  const container = document.querySelector(selector);

  if (!container) {
    throw new Error(`Mount point not found: ${selector}`);
  }

  if ('element' in nodeRef && nodeRef.element) {
    container.appendChild(nodeRef.element as unknown as Node);
  }

  return nodeRef;
}

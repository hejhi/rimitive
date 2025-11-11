/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */

import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/map';
import { On } from '@lattice/view/on';
import { createApi } from '@lattice/view/presets/core';
import { createApi as createSignalsApi } from '@lattice/signals/presets/core';

import { createDOMRenderer, DOMRendererConfig } from '@lattice/view/renderers/dom';
import { Signal } from '@lattice/signals/signal';
import { Effect } from '@lattice/signals/effect';
import { Computed } from '@lattice/signals/computed';

const renderer = createDOMRenderer();

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the renderer
 */
export const { api, create, mount } = createApi(
  renderer,
  {
    el: El<DOMRendererConfig>(),
    map: Map<DOMRendererConfig>(),
    on: On(),
  },
  createSignalsApi({
    signal: Signal(),
    effect: Effect(),
    computed: Computed(),
  }).api
);

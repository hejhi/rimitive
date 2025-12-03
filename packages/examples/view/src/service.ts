/**
 * App-level API
 *
 * All components in this app use this shared API.
 * This ensures consistent renderer configuration across the entire app.
 */
import { createDOMSvc } from '@lattice/view/presets/dom';

export const { signal, computed, on, match, el, t, map, mount } =
  createDOMSvc();

export type { DOMSvc, DOMSignals, DOMView } from '@lattice/view/presets/dom';

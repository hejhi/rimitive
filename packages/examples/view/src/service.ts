import { createDOMSvc } from '@lattice/view/presets/dom';

export const use = createDOMSvc();
export const { signal, computed, on, match, el, map, mount } = use();

export type { DOMSvc, DOMSignals } from '@lattice/view/presets/dom';

import { createDOMSvc } from '@lattice/view/presets/dom';

export const { signal, computed, on, match, el, map, mount } = createDOMSvc();

export type { DOMSvc, DOMSignals } from '@lattice/view/presets/dom';

import { createSignals } from '@lattice/signals';
import { createDOMView } from '@lattice/view/presets/dom';

export const use = createDOMView({ signals: createSignals() });
export const { signal, computed, on, match, el, map, mount } = use();

export type { DOMSignals } from '@lattice/view/presets/dom';

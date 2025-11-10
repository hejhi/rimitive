import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createApi } from '@lattice/view/presets/core';

export const {
  create,
  deps,
  extensions,
  mount
} = createApi(createDOMRenderer());
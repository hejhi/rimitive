import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { MountModule } from '@lattice/view/deps/mount';
import { createRouter } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';

// Create the DOM adapter
const adapter = createDOMAdapter();

// Create adapter-bound view modules
const ElModule = createElModule(adapter);
const MapModule = createMapModule(adapter);
const MatchModule = createMatchModule(adapter);

// Compose everything together
const use = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  ElModule,
  MapModule,
  MatchModule,
  MountModule
);

const svc = use();

export const router = createRouter<DOMAdapterConfig>(svc, {
  initialPath:
    typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '/',
});

// Re-export for components that don't need route context
export const { el, computed, signal, map, match, mount } = svc;
export const { navigate, currentPath } = router;

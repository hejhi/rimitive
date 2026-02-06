/**
 * PageService Type
 *
 * Minimal interface that pages require.
 * Both worker (parse5) and main thread (DOM) services satisfy this.
 */
import type { SignalFactory, ComputedFactory } from '@rimitive/signals/extend';
import type { TreeConfig } from '@rimitive/view/types';
import type { ElFactory } from '@rimitive/view/el';
import type { MapFactory } from '@rimitive/view/map';
import type { Router } from '@rimitive/router';
import type { Actions } from '../actions';
import type { DataCache } from '../pwa';

export type PageService = {
  signal: SignalFactory;
  computed: ComputedFactory;
  el: ElFactory<TreeConfig>;
  map: MapFactory<TreeConfig>;
  router: Router;
  actions: Actions;
  cache: DataCache;
};

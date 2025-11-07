/**
 * Core View Preset
 * Pre-configured bundle of view primitives with signals integration.
 * This provides a complete API for building reactive UIs with automatic wiring.
 */

import { createApi as createLatticeApi } from '@lattice/lattice';
import { createCoreCtx, extensions as signalExtensions } from '@lattice/signals/presets/core';
import { createScopes } from '../helpers/scope';
import { createProcessChildren } from '../helpers/processChildren';
import { El } from '../el';
import { Map } from '../helpers/map';
import { On } from '../on';
import { createLatticeContext } from '../context';
import { createDOMRenderer } from '../renderers/dom';
import type { Renderer, Element as RendererElement, TextNode } from '../renderer';
import type { LatticeContext } from '../context';

export const extensions = {
  el: El(),
  map: Map(),
  on: On(),
};

export function createViewCtx<
  TElement extends RendererElement = HTMLElement,
  TText extends TextNode = Text
>({
  viewCtx,
  renderer,
  signalsCtx,
  signalsApi,
}: {
  viewCtx: LatticeContext<TElement>;
  renderer: Renderer<TElement, TText>;
  signalsCtx: ReturnType<typeof createCoreCtx>;
  signalsApi: ReturnType<typeof createLatticeApi<typeof signalExtensions, ReturnType<typeof createCoreCtx>>>;
}) {
  const { disposeScope, scopedEffect, onCleanup, createElementScope } =
    createScopes<TElement>({
      ctx: viewCtx,
      track: signalsCtx.track,
      dispose: signalsCtx.dispose,
      baseEffect: signalsApi.effect,
    });

  const { processChildren } = createProcessChildren<TElement, TText>({
    scopedEffect,
    renderer,
  });

  // Return unified context with all dependencies needed by extensions
  return {
    // For El
    ctx: viewCtx,
    scopedEffect,
    renderer,
    createElementScope,
    disposeScope,
    onCleanup,
    processChildren,
    // For Map
    signalCtx: signalsCtx.ctx,
    signal: signalsApi.signal,
    // For On
    startBatch: signalsCtx.startBatch,
    endBatch: signalsCtx.endBatch,
  };
}

/**
 * Options for creating the view API
 */
export type CreateViewApiOpts<
  TElement extends RendererElement = HTMLElement,
  TText extends TextNode = Text
> = {
  /**
   * Renderer implementation (defaults to DOM renderer)
   */
  renderer?: Renderer<TElement, TText>;

  /**
   * View context (defaults to new LatticeContext)
   */
  viewCtx?: LatticeContext<TElement>;

  /**
   * Signals context (defaults to createCoreCtx())
   * Pass this if you want to share signals context across multiple view instances
   */
  signalsCtx?: ReturnType<typeof createCoreCtx>;
};

export function createApi<
  TElement extends RendererElement = HTMLElement,
  TText extends TextNode = Text
>(
  opts: CreateViewApiOpts<TElement, TText> = {}
): ReturnType<typeof createLatticeApi<typeof signalExtensions, ReturnType<typeof createCoreCtx>>> &
   ReturnType<typeof createLatticeApi<typeof extensions, ReturnType<typeof createViewCtx<TElement, TText>>>> {
  // Use provided or create default contexts
  const renderer = opts.renderer ?? (createDOMRenderer() as unknown as Renderer<TElement, TText>);
  const viewCtx = opts.viewCtx ?? createLatticeContext<TElement>();
  const signalsCtx = opts.signalsCtx ?? createCoreCtx();

  // Create signals API
  const signalsApi = createLatticeApi(signalExtensions, signalsCtx);

  // Create view context with all dependencies
  const viewDeps = createViewCtx({
    viewCtx,
    renderer,
    signalsCtx,
    signalsApi,
  });

  // Instantiate view extensions with context - this calls .create() on each
  const viewApi = createLatticeApi(extensions, viewDeps);

  // Combine signals API + view API
  return {
    ...signalsApi,
    ...viewApi,
  };
}

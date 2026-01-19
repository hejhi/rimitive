import { createRoot } from 'react-dom/client';
import { createElement, type ComponentType } from 'react';

type EffectFn = (fn: () => void | (() => void)) => () => void;

/**
 * Creates a ref callback that mounts a React component into a DOM element.
 * The component re-renders whenever reactive dependencies in the props getter change.
 *
 * This enables embedding React components (like @xyflow/react) inside a Rimitive app.
 *
 * @param effect - The effect function from a signal service (svc.effect)
 * @param Component - The React component to render
 * @param getProps - A function that returns props for the component (can read signals)
 * @returns A ref callback for use with el().ref()
 *
 * @example
 * ```tsx
 * import { createReactBridge } from '@rimitive/react';
 * import { ReactFlow } from '@xyflow/react';
 *
 * const MyGraph = (svc) => {
 *   const { el, signal, effect } = svc;
 *   const nodes = signal([]);
 *   const edges = signal([]);
 *
 *   const graphRef = createReactBridge(effect, ReactFlow, () => ({
 *     nodes: nodes(),
 *     edges: edges(),
 *     onNodesChange: (changes) => { ... },
 *   }));
 *
 *   return el('div').props({ className: 'graph-container' }).ref(graphRef)();
 * };
 * ```
 */
export function createReactBridge<P extends object>(
  effect: EffectFn,
  Component: ComponentType<P>,
  getProps: () => P
): (container: HTMLElement) => () => void {
  return (container: HTMLElement) => {
    const root = createRoot(container);

    const stopEffect = effect(() => {
      root.render(createElement(Component, getProps()));
    });

    return () => {
      stopEffect();
      root.unmount();
    };
  };
}

/**
 * Creates a ref callback that renders arbitrary React content into a DOM element.
 * The content re-renders whenever reactive dependencies in the render function change.
 *
 * This is a lower-level alternative to createReactBridge for when you need more control.
 *
 * @param effect - The effect function from a signal service (svc.effect)
 * @param render - A function that returns a React element (can read signals)
 * @returns A ref callback for use with el().ref()
 *
 * @example
 * ```tsx
 * import { renderReact } from '@rimitive/react';
 *
 * const status = signal('loading');
 *
 * const ref = renderReact(effect, () => (
 *   <StatusBadge variant={status() === 'error' ? 'destructive' : 'default'}>
 *     {status()}
 *   </StatusBadge>
 * ));
 *
 * el('div').ref(ref)();
 * ```
 */
export function renderReact(
  effect: EffectFn,
  render: () => React.ReactNode
): (container: HTMLElement) => () => void {
  return (container: HTMLElement) => {
    const root = createRoot(container);

    const stopEffect = effect(() => {
      root.render(render());
    });

    return () => {
      stopEffect();
      root.unmount();
    };
  };
}

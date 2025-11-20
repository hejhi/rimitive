import type {
  RendererConfig,
  RefSpec,
  Reactive,
  LifecycleCallback,
  ElRefSpecChild,
} from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { CreateScopes } from '@lattice/view/helpers/scope';
import type { LatticeExtension } from '@lattice/lattice';
import type { ShowFactory } from '@lattice/view/show';
import type { ElementProps } from '@lattice/view/el';
import type { ElMethod } from '@lattice/view/component';

/**
 * Route parameter map extracted from path patterns
 * e.g., '/products/:id' -> { id: string }
 */
export type RouteParams = Record<string, string>;

/**
 * Matched route information
 */
export interface RouteMatch {
  path: string;
  params: RouteParams;
}

/**
 * Status bit for route specs - next power of 2 after STATUS_COMMENT (16)
 */
export const STATUS_ROUTE_SPEC = 32; // 100000

/**
 * Route-specific metadata
 */
export interface RouteMetadata<TConfig extends RendererConfig> {
  relativePath: string;
  rebuild: (parentPath: string) => RouteSpec<TConfig['baseElement']>;
}

/**
 * RouteSpec wraps a RefSpec with routing metadata
 * Uses true wrapper pattern - delegates to internal RefSpec via closure
 * Status is ONLY STATUS_ROUTE_SPEC (32) - not combined with STATUS_REF_SPEC
 * The wrapped RefSpec is kept internal and accessed via delegation
 *
 * Note: Does not extend RefSpec to avoid status type conflict.
 * Instead, provides same callable/create interface through delegation.
 */
export interface RouteSpec<TElement> {
  status: typeof STATUS_ROUTE_SPEC;
  routeMetadata: RouteMetadata<RendererConfig>;
  // Unwrap method to get the inner RefSpec for renderer
  unwrap(): RefSpec<TElement>;
  (...lifecycleCallbacks: LifecycleCallback<TElement>[]): RouteSpec<TElement>;
  create<TExt = Record<string, unknown>>(
    api?: unknown,
    extensions?: TExt
  ): import('@lattice/view/types').NodeRef<TElement> & TExt;
}

/**
 * Signal function with both getter and setter
 */
export interface SignalFunction<T> {
  (): T;
  (value: T): void;
  peek(): T;
}

/**
 * Computed function (read-only reactive)
 */
export interface ComputedFunction<T> {
  (): T;
  peek(): T;
}

/**
 * Match function type
 */
export interface MatchFunction<TBaseElement> {
  <T, TElement extends TBaseElement>(
    reactive: Reactive<T>
  ): (matcher: (value: T) => RefSpec<TElement> | null) => RefSpec<TElement>;
}

/**
 * @internal
 * DEPRECATED: Only used by route.ts (old implementation kept temporarily)
 * Options passed to old route factory
 */
export type RouteOpts<TConfig extends RendererConfig> = {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  el: <Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: Record<string, unknown>
  ) => (...children: unknown[]) => RefSpec<TConfig['elements'][Tag]>;
  match: MatchFunction<TConfig['baseElement']>;
  show: ShowFactory<TConfig['baseElement']>['method'];
  currentPath: Reactive<string>;
  scopedEffect: CreateScopes['scopedEffect'];
  renderer: import('@lattice/view/types').Renderer<TConfig>;
  createElementScope: CreateScopes['createElementScope'];
  onCleanup: CreateScopes['onCleanup'];
};

/**
 * @internal
 * DEPRECATED: Only used by route.ts (old implementation kept temporarily)
 * Component that receives the API
 */
export type RouteComponent<TConfig extends RendererConfig> =
  | RefSpec<TConfig['baseElement']>
  | ((
      api: RouteOpts<TConfig> & {
        params: ComputedFunction<RouteParams>;
        outlet: () => RefSpec<TConfig['baseElement']> | null;
        navigate: (path: string) => void;
      }
    ) => RefSpec<TConfig['baseElement']>);

/**
 * @internal
 * DEPRECATED: Only used by route.ts (old implementation kept temporarily)
 * Route factory type
 */
export type RouteFactory<TConfig extends RendererConfig> = LatticeExtension<
  'route',
  {
    (
      path: string,
      component: RouteComponent<TConfig>
    ): (
      ...children: (
        | RefSpec<TConfig['baseElement']>
        | RouteSpec<TConfig['baseElement']>
      )[]
    ) => RouteSpec<TConfig['baseElement']>;
  }
>;

/**
 * Options passed to Link factory
 *
 * Link is DOM-only - routing with window.history is a web browser concept
 */
export type LinkOpts = {
  el: ElMethod<DOMRendererConfig>;
  navigate: (path: string) => void;
};

/**
 * Link factory type
 *
 * Link is DOM-only - no need for generic renderer abstraction
 */
export type LinkFactory = LatticeExtension<
  'Link',
  {
    (
      props: ElementProps<DOMRendererConfig, 'a'> & { href: string }
    ): (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement>;
  }
>;

/**
 * Location API - reactive access to URL components
 */
export interface LocationAPI {
  pathname: ComputedFunction<string>;
  search: ComputedFunction<string>;
  hash: ComputedFunction<string>;
  query: ComputedFunction<Record<string, string>>;
}

/**
 * Options passed to location factory
 */
export type LocationOpts = {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  currentPath: Reactive<string>;
};

/**
 * Location factory type
 */
export type LocationFactory = LatticeExtension<
  'location',
  {
    (): LocationAPI;
  }
>;

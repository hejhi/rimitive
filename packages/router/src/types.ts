import type {
  AdapterConfig,
  RefSpec,
  Reactive,
  ElRefSpecChild,
  Readable,
  Writable,
} from '@lattice/view/types';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import type { ServiceDefinition } from '@lattice/lattice';
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
export type RouteMatch = {
  path: string;
  params: RouteParams;
};

/**
 * Status bit for route specs - next power of 2 after STATUS_COMMENT (16)
 */
export const STATUS_ROUTE_SPEC = 32; // 100000

/**
 * Route-specific metadata
 */
export type RouteMetadata<TConfig extends AdapterConfig> = {
  relativePath: string;
  rebuild: (parentPath: string) => RouteSpec<TConfig['baseElement']>;
};

/**
 * RouteSpec wraps a RefSpec with routing metadata
 * Uses true wrapper pattern - delegates to internal RefSpec via closure
 * Status is ONLY STATUS_ROUTE_SPEC (32) - not combined with STATUS_REF_SPEC
 * The wrapped RefSpec is kept internal and accessed via delegation
 *
 * Note: Does not extend RefSpec to avoid status type conflict.
 * Instead, provides same create type through delegation.
 */
export type RouteSpec<TElement> = {
  status: typeof STATUS_ROUTE_SPEC;
  routeMetadata: RouteMetadata<AdapterConfig>;
  // Unwrap method to get the inner RefSpec for adapter
  unwrap(): RefSpec<TElement>;
  create<TExt = Record<string, unknown>>(
    svc?: unknown,
    extensions?: TExt
  ): import('@lattice/view/types').NodeRef<TElement> & TExt;
};

/**
 * Match function type
 */
export type MatchFunction<TBaseElement> = {
  <T, TElement extends TBaseElement>(
    reactive: Reactive<T>,
    matcher: (value: T) => RefSpec<TElement> | null
  ): RefSpec<TElement>;
};

/**
 * Options passed to Link factory
 *
 * Link is DOM-only - routing with window.history is a web browser concept
 */
export type LinkOpts = {
  el: ElMethod<DOMAdapterConfig>;
  navigate: (path: string) => void;
};

/**
 * Link factory type
 *
 * Link is DOM-only - no need for generic adapter abstraction
 */
export type LinkFactory = ServiceDefinition<
  'Link',
  {
    (
      props: ElementProps<DOMAdapterConfig, 'a'> & { href: string }
    ): (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement>;
  }
>;

/**
 * Location - reactive access to URL components
 */
export type LocationSvc = {
  pathname: Readable<string>;
  search: Readable<string>;
  hash: Readable<string>;
  query: Readable<Record<string, string>>;
};

/**
 * Options passed to location factory
 */
export type LocationOpts = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
  currentPath: Reactive<string>;
};

/**
 * Location factory type
 */
export type LocationFactory = ServiceDefinition<
  'location',
  {
    (): LocationSvc;
  }
>;

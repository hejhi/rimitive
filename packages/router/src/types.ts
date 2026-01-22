import type {
  TreeConfig,
  NodeOf,
  RefSpec,
  Reactive,
  ElRefSpecChild,
  Readable,
  Writable,
} from '@rimitive/view/types';
import type { DOMTreeConfig } from '@rimitive/view/adapters/dom';
import type { ElementProps, ElFactory } from '@rimitive/view/el';

/**
 * Route parameter map extracted from path patterns
 * e.g., '/products/:id' -\> \{ id: string \}
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
 * Route-specific metadata
 */
export type RouteMetadata<TConfig extends TreeConfig> = {
  relativePath: string;
  rebuild: (parentPath: string) => Route<NodeOf<TConfig>>;
};

/**
 * Route wraps a RefSpec with routing metadata for path composition.
 * Delegates to internal RefSpec via closure.
 */
export type Route<TElement> = {
  routeMetadata: RouteMetadata<TreeConfig>;
  /** Get the inner RefSpec for the adapter */
  unwrap(): RefSpec<TElement>;
  create<TExt = Record<string, unknown>>(
    svc?: unknown,
    extensions?: TExt
  ): import('@rimitive/view/types').NodeRef<TElement> & TExt;
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
  el: ElFactory<DOMTreeConfig>;
  navigate: (path: string) => void;
};

/**
 * Link function type
 *
 * Link is DOM-only - no need for generic adapter abstraction
 */
export type LinkFunction = (
  props: ElementProps<DOMTreeConfig, 'a'> & { href: string }
) => (...children: ElRefSpecChild[]) => RefSpec<HTMLAnchorElement>;

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
export type LocationFactory = () => LocationSvc;

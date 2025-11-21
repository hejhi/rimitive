import {
  InstrumentationContext,
  LatticeContext,
  ServiceContext,
  ServiceDefinition,
} from './types';

interface ContextState {
  disposed: boolean;
  disposers: Set<() => void>;
}

export interface CreateContextOptions {
  instrumentation?: InstrumentationContext;
}

export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(...services: TServices): LatticeContext<TServices>;
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(
  options: CreateContextOptions,
  ...services: TServices
): LatticeContext<TServices>;
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(
  ...args: [CreateContextOptions, ...TServices] | TServices
): LatticeContext<TServices> {
  let rawServices: TServices;
  let options: CreateContextOptions | undefined;

  if (
    args.length > 0 &&
    args[0] &&
    typeof args[0] === 'object' &&
    'instrumentation' in args[0]
  ) {
    options = args[0];
    rawServices = args.slice(1) as unknown as TServices;
  } else {
    rawServices = args as TServices;
  }

  const services = rawServices.flat(1) as unknown as TServices;

  const names = new Set<string>();
  for (const service of services) {
    if (names.has(service.name)) {
      throw new Error(`Duplicate service name: ${service.name}`);
    }
    names.add(service.name);
  }

  const state: ContextState = {
    disposed: false,
    disposers: new Set(),
  };

  const serviceCtx: ServiceContext = {
    destroy(cleanup: () => void): void {
      state.disposers.add(cleanup);
    },

    get isDestroyed(): boolean {
      return state.disposed;
    },
  };

  // Build the context object
  const context = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      for (const service of services) {
        service.destroy?.(serviceCtx);
      }

      for (const disposer of state.disposers) {
        disposer();
      }
      state.disposers.clear();
    },
  } as LatticeContext<TServices>;

  // Add each service's impl to the context
  for (const service of services) {
    service.init?.(serviceCtx);
    let impl = service.impl;

    if (options?.instrumentation && service.instrument) {
      impl = service.instrument(impl, options.instrumentation, serviceCtx);
    }

    if (service.adapt) impl = service.adapt(impl, serviceCtx);

    (context as Record<string, unknown>)[service.name] = impl;
  }

  return context;
}

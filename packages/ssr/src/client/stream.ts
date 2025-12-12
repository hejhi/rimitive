/**
 * Client-side Streaming Support
 *
 * Utilities for connecting to server-streamed data.
 */

import type { Loader } from '@rimitive/view/load';

/**
 * Stream receiver interface - matches what stream.bootstrap() creates on the server.
 * The receiver queues data until a loader connects, then forwards directly.
 */
export type StreamReceiver = {
  push: (id: string, data: unknown) => void;
  connect: (loader: Loader) => void;
};

/** Object with a loader property (e.g., a service) */
type HasLoader = { loader: Loader };

/**
 * Connect to a stream receiver.
 *
 * Call this after hydration to connect the loader to the stream receiver
 * created by stream.bootstrap(). The receiver flushes its queue
 * and forwards future chunks directly to the loader.
 *
 * @param target - A loader or an object with a loader property (e.g., service)
 * @param streamKey - The window property name (stream.key)
 *
 * @example
 * ```ts
 * // Server: const { bootstrap } = createStreamWriter('__APP_STREAM__');
 * // Server: res.write(bootstrap());
 *
 * // Client
 * import { createClientAdapter, connectStream } from '@rimitive/ssr/client';
 *
 * const adapter = createClientAdapter(document.querySelector('.app')!);
 * const service = createService(adapter);
 * AppLayout(service).create(service);
 * adapter.activate();
 *
 * // Connect to the stream
 * connectStream(service, '__APP_STREAM__');
 * ```
 */
export function connectStream(
  target: Loader | HasLoader,
  streamKey: string
): void {
  const loader = 'loader' in target ? target.loader : target;
  const receiver = (window as unknown as Record<string, unknown>)[streamKey] as
    | StreamReceiver
    | undefined;
  if (receiver && typeof receiver.connect === 'function') {
    receiver.connect(loader);
  }
}

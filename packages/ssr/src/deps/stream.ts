/**
 * Stream Writer
 *
 * Factory for generating streaming script tags that enable progressive SSR.
 * Use with renderToStream() for the full streaming flow.
 */

/**
 * Creates the streaming receiver object.
 * This function is stringified and executed in the browser.
 * Queues data chunks until a loader connects, then forwards directly.
 * @internal
 */
function createStreamingReceiver() {
  const queue: Array<[string, unknown]> = [];
  let loader: { setData: (id: string, data: unknown) => void } | null = null;

  return {
    push(id: string, data: unknown) {
      if (loader) {
        loader.setData(id, data);
      } else {
        queue.push([id, data]);
      }
    },
    connect(l: { setData: (id: string, data: unknown) => void }) {
      loader = l;
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item) l.setData(item[0], item[1]);
      }
      queue.length = 0;
    },
  };
}

/**
 * A factory for generating streaming script tags.
 */
export type StreamWriter = {
  /** The stream key (window property name) */
  key: string;
  /** Script tag that initializes the streaming receiver */
  bootstrap: () => string;
  /** Script tag that pushes data to the receiver */
  chunk: (id: string, data: unknown) => string;
};

/**
 * Create a stream writer for generating streaming script tags.
 *
 * The writer generates script tags that set up and communicate with a
 * streaming receiver on the client. The receiver queues data chunks until
 * a loader connects, then forwards directly.
 *
 * @param streamKey - The window property name (e.g., '__MY_APP_STREAM__')
 * @returns StreamWriter with bootstrap() and chunk() methods
 *
 * @example
 * ```ts
 * const { bootstrap, chunk } = createStreamWriter('__APP_STREAM__');
 *
 * res.write(`<head>${bootstrap()}</head>`);
 * res.write(`<body>${initialHtml}</body>`);
 *
 * // As async boundaries resolve:
 * res.write(chunk('stats', { users: 100 }));
 * ```
 */
export function createStreamWriter(streamKey: string): StreamWriter {
  return {
    key: streamKey,
    bootstrap: () =>
      `<script>window.${streamKey}=(${createStreamingReceiver.toString()})();</script>`,
    chunk: (id, data) =>
      `<script>${streamKey}.push(${JSON.stringify(id)},${JSON.stringify(data)})</script>`,
  };
}

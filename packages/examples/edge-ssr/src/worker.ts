/**
 * Edge SSR Worker
 *
 * Cloudflare Workers entry point demonstrating edge SSR patterns.
 * See the `edge/` directory for copy-able utilities.
 */

import { renderToResponse, renderToStreamingResponse } from './edge/index.js';
import { createService } from './service.js';
import { App } from './App.js';
import { STREAM_KEY } from './config.js';
import { styles } from './styles.js';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Common options for all routes
    const baseOptions = {
      title: 'Rimitive Edge SSR',
      styles,
      clientSrc: '/client.js',
      createService,
      createApp: App,
    };

    // Route: /streaming - Streaming SSR with async boundaries
    if (pathname === '/streaming') {
      return renderToStreamingResponse(pathname, {
        ...baseOptions,
        streamKey: STREAM_KEY,
      });
    }

    // All other routes - Basic SSR
    return renderToResponse(pathname, baseOptions);
  },
};

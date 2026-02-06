/**
 * Client-side Hydration
 *
 * Hydrates the server-rendered HTML and connects to the streaming receiver.
 * See the `edge/` directory for copy-able utilities.
 */

import { hydrateApp } from './edge/index.js';
import { createService } from './service.js';
import { App } from './App.js';
import { STREAM_KEY, APP_ROOT } from './config.js';

hydrateApp({
  rootSelector: APP_ROOT,
  streamKey: STREAM_KEY,
  createService,
  createApp: App,
});

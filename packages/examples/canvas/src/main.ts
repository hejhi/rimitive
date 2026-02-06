/**
 * Share Card Demo - Entry Point
 *
 * Wires all dependencies and passes them to the portable App.
 * This is the only place that imports concrete implementations.
 */
import {
  dom,
  canvas,
  signal,
  computed,
  effect,
  domCardSvc,
  canvasCardSvc,
} from './service';
import { App } from './components/App';
import { shareCard } from './components/ShareCard';

// Bind behaviors once at startup
const AppComponent = App({
  dom,
  canvas,
  signals: { signal, computed, effect },
  cards: { dom: domCardSvc(shareCard), canvas: canvasCardSvc(shareCard) },
});

// Mount the app
const appRef = dom.mount(AppComponent());

// Append to document
const root = document.getElementById('root');
root!.appendChild(appRef.element!);

/**
 * Router Example Entry Point
 *
 * Simple client-side routing example.
 */
import { svc } from './service';
import { AppLayout } from './layouts/AppLayout';

// Create and mount the app
const container = document.querySelector('#app');
if (container) {
  const appRef = AppLayout(svc).create(svc);
  container.appendChild(appRef.element as HTMLElement);
}

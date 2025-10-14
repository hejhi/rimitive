import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLifecycleObserver } from './dom-lifecycle';

/**
 * Wait for MutationObserver to process pending mutations
 */
async function waitForMutations(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('Lifecycle Observer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create container in document for real DOM behavior
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  describe('connection', () => {
    it('fires callback when element connects to DOM', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const onConnected = vi.fn();

      observer.observeConnection(element, onConnected);

      // element not yet connected
      expect(onConnected).not.toHaveBeenCalled();

      // User adds element to DOM
      container.appendChild(element);
      await waitForMutations();

      // callback fired
      expect(onConnected).toHaveBeenCalledOnce();
      expect(onConnected).toHaveBeenCalledWith(element);
    });

    it('fires immediately for already-connected elements', () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      container.appendChild(element);
      const onConnected = vi.fn();

      // element already in DOM
      expect(element.isConnected).toBe(true);

      observer.observeConnection(element, onConnected);

      // callback fired immediately
      expect(onConnected).toHaveBeenCalledOnce();
      expect(onConnected).toHaveBeenCalledWith(element);
    });

    it('fires for descendant elements when parent connects', async () => {
      const observer = createLifecycleObserver();
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      const onConnected = vi.fn();

      observer.observeConnection(child, onConnected);

      // User adds parent (with child inside) to DOM
      container.appendChild(parent);
      await waitForMutations();

      // descendant element detected
      expect(onConnected).toHaveBeenCalledOnce();
    });

    it('stops observing when cleanup is called', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const onConnected = vi.fn();

      const cleanup = observer.observeConnection(element, onConnected);

      // User cancels observation before connection
      cleanup();

      container.appendChild(element);
      await waitForMutations();

      // callback not fired after cleanup
      expect(onConnected).not.toHaveBeenCalled();
    });

    it('returns cleanup from callback that runs on disconnect', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const connectionCleanup = vi.fn();
      const onConnected = vi.fn(() => connectionCleanup);

      observer.observeConnection(element, onConnected);
      observer.observeDisconnection(element, vi.fn());

      // Element connects
      container.appendChild(element);
      await waitForMutations();
      expect(onConnected).toHaveBeenCalledOnce();
      expect(connectionCleanup).not.toHaveBeenCalled();

      // Element disconnects - cleanup should run
      container.removeChild(element);
      await waitForMutations();

      // connection cleanup was called
      expect(connectionCleanup).toHaveBeenCalledOnce();
    });
  });

  describe('disconnection', () => {
    it('fires callback when element disconnects from DOM', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      container.appendChild(element);
      const onDisconnected = vi.fn();

      observer.observeDisconnection(element, onDisconnected);

      // User removes element from DOM
      container.removeChild(element);
      await waitForMutations();

      // callback fired
      expect(onDisconnected).toHaveBeenCalledOnce();
      expect(onDisconnected).toHaveBeenCalledWith(element);
    });

    it('fires for descendant elements when parent disconnects', async () => {
      const observer = createLifecycleObserver();
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      container.appendChild(parent);
      const onDisconnected = vi.fn();

      observer.observeDisconnection(child, onDisconnected);

      // User removes parent (with child inside) from DOM
      container.removeChild(parent);
      await waitForMutations();

      // descendant element detected
      expect(onDisconnected).toHaveBeenCalledOnce();
    });

    it('stops observing when cleanup is called', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      container.appendChild(element);
      const onDisconnected = vi.fn();

      const cleanup = observer.observeDisconnection(element, onDisconnected);

      // User cancels observation before disconnection
      cleanup();

      container.removeChild(element);
      await waitForMutations();

      // callback not fired after cleanup
      expect(onDisconnected).not.toHaveBeenCalled();
    });
  });

  describe('multiple elements', () => {
    it('tracks multiple elements independently', async () => {
      const observer = createLifecycleObserver();
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');
      const onConnected1 = vi.fn();
      const onConnected2 = vi.fn();

      observer.observeConnection(element1, onConnected1);
      observer.observeConnection(element2, onConnected2);

      // Connect first element
      container.appendChild(element1);
      await waitForMutations();
      expect(onConnected1).toHaveBeenCalledOnce();
      expect(onConnected2).not.toHaveBeenCalled();

      // Connect second element
      container.appendChild(element2);
      await waitForMutations();
      expect(onConnected2).toHaveBeenCalledOnce();

      // each element tracked independently
      expect(onConnected1).toHaveBeenCalledOnce();
    });

    it('handles mixed connections and disconnections', async () => {
      const observer = createLifecycleObserver();
      const element1 = document.createElement('div');
      const element2 = document.createElement('div');
      container.appendChild(element1);
      container.appendChild(element2);

      const onDisconnected1 = vi.fn();
      const onDisconnected2 = vi.fn();

      observer.observeDisconnection(element1, onDisconnected1);
      observer.observeDisconnection(element2, onDisconnected2);

      // Disconnect first element
      container.removeChild(element1);
      await waitForMutations();
      expect(onDisconnected1).toHaveBeenCalledOnce();
      expect(onDisconnected2).not.toHaveBeenCalled();

      // Disconnect second element
      container.removeChild(element2);
      await waitForMutations();
      expect(onDisconnected2).toHaveBeenCalledOnce();

      // each element tracked independently
      expect(onDisconnected1).toHaveBeenCalledOnce();
    });
  });

  describe('no-op behavior', () => {
    it('handles undefined callbacks gracefully', () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');

      // safe to pass undefined
      const cleanup1 = observer.observeConnection(element, undefined);
      const cleanup2 = observer.observeDisconnection(element, undefined);

      container.appendChild(element);
      container.removeChild(element);

      // no errors, cleanup functions returned
      expect(cleanup1).toBeTypeOf('function');
      expect(cleanup2).toBeTypeOf('function');
    });

    it('allows cleanup to be called multiple times', () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const onConnected = vi.fn();

      const cleanup = observer.observeConnection(element, onConnected);

      // safe to call cleanup multiple times
      cleanup();
      cleanup();
      cleanup();

      container.appendChild(element);

      // callback still not fired
      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe('cleanup lifecycle', () => {
    it('runs connection cleanup before disconnection callback', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const callOrder: string[] = [];

      const connectionCleanup = vi.fn(() => callOrder.push('cleanup'));
      const onConnected = vi.fn(() => connectionCleanup);
      const onDisconnected = vi.fn(() => callOrder.push('disconnected'));

      observer.observeConnection(element, onConnected);
      observer.observeDisconnection(element, onDisconnected);

      container.appendChild(element);
      await waitForMutations();
      container.removeChild(element);
      await waitForMutations();

      // cleanup runs before disconnection callback
      expect(callOrder).toEqual(['cleanup', 'disconnected']);
    });

    it('stops tracking element after disconnection', async () => {
      const observer = createLifecycleObserver();
      const element = document.createElement('div');
      const onDisconnected = vi.fn();

      observer.observeDisconnection(element, onDisconnected);

      // Connect and disconnect
      container.appendChild(element);
      await waitForMutations();
      container.removeChild(element);
      await waitForMutations();
      expect(onDisconnected).toHaveBeenCalledOnce();

      // Reconnect element - should not fire again (not being tracked)
      container.appendChild(element);
      await waitForMutations();
      container.removeChild(element);
      await waitForMutations();

      // callback only fired once
      expect(onDisconnected).toHaveBeenCalledOnce();
    });
  });
});

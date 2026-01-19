import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import React from 'react';
import { createReactBridge, renderReact } from './bridge';
import { createTestSignalSvc } from '../test-setup';

describe('React Bridge', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createReactBridge', () => {
    it('should mount a React component into a container', () => {
      const svc = createTestSignalSvc();
      const TestComponent = ({ text }: { text: string }) => (
        <span data-testid="test">{text}</span>
      );

      const ref = createReactBridge(svc.effect, TestComponent, () => ({
        text: 'Hello',
      }));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(container.querySelector('[data-testid="test"]')?.textContent).toBe(
        'Hello'
      );

      act(() => {
        cleanup!();
      });
    });

    it('should re-render when signal dependencies change', () => {
      const svc = createTestSignalSvc();
      const message = svc.signal('initial');

      const TestComponent = ({ text }: { text: string }) => (
        <span data-testid="test">{text}</span>
      );

      const ref = createReactBridge(svc.effect, TestComponent, () => ({
        text: message(),
      }));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(container.querySelector('[data-testid="test"]')?.textContent).toBe(
        'initial'
      );

      act(() => {
        message('updated');
      });

      expect(container.querySelector('[data-testid="test"]')?.textContent).toBe(
        'updated'
      );

      act(() => {
        cleanup!();
      });
    });

    it('should re-render when computed dependencies change', () => {
      const svc = createTestSignalSvc();
      const count = svc.signal(5);
      const doubled = svc.computed(() => count() * 2);

      const TestComponent = ({ value }: { value: number }) => (
        <span data-testid="test">{value}</span>
      );

      const ref = createReactBridge(svc.effect, TestComponent, () => ({
        value: doubled(),
      }));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(container.querySelector('[data-testid="test"]')?.textContent).toBe(
        '10'
      );

      act(() => {
        count(10);
      });

      expect(container.querySelector('[data-testid="test"]')?.textContent).toBe(
        '20'
      );

      act(() => {
        cleanup!();
      });
    });

    it('should unmount React component on cleanup', () => {
      const svc = createTestSignalSvc();
      const unmountSpy = vi.fn();

      const TestComponent = () => {
        React.useEffect(() => unmountSpy, []);
        return <span>Test</span>;
      };

      const ref = createReactBridge(svc.effect, TestComponent, () => ({}));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(unmountSpy).not.toHaveBeenCalled();

      act(() => {
        cleanup!();
      });

      expect(unmountSpy).toHaveBeenCalledOnce();
    });

    it('should stop effect on cleanup', () => {
      const svc = createTestSignalSvc();
      const count = svc.signal(0);
      const renderCount = { current: 0 };

      const TestComponent = ({ value }: { value: number }) => {
        renderCount.current++;
        return <span>{value}</span>;
      };

      const ref = createReactBridge(svc.effect, TestComponent, () => ({
        value: count(),
      }));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      const initialRenderCount = renderCount.current;

      act(() => {
        cleanup!();
      });

      // After cleanup, signal changes should not trigger re-renders
      count(1);
      count(2);
      count(3);

      expect(renderCount.current).toBe(initialRenderCount);
    });

    it('should pass event handlers correctly', () => {
      const svc = createTestSignalSvc();
      const clickHandler = vi.fn();

      const TestComponent = ({ onClick }: { onClick: () => void }) => (
        <button data-testid="btn" onClick={onClick}>
          Click
        </button>
      );

      const ref = createReactBridge(svc.effect, TestComponent, () => ({
        onClick: clickHandler,
      }));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      const button = container.querySelector(
        '[data-testid="btn"]'
      ) as HTMLButtonElement;

      act(() => {
        button.click();
      });

      expect(clickHandler).toHaveBeenCalledOnce();

      act(() => {
        cleanup!();
      });
    });
  });

  describe('renderReact', () => {
    it('should render arbitrary React content', () => {
      const svc = createTestSignalSvc();

      const ref = renderReact(svc.effect, () => (
        <div data-testid="content">Hello World</div>
      ));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(
        container.querySelector('[data-testid="content"]')?.textContent
      ).toBe('Hello World');

      act(() => {
        cleanup!();
      });
    });

    it('should re-render when signal dependencies change', () => {
      const svc = createTestSignalSvc();
      const items = svc.signal(['a', 'b']);

      const ref = renderReact(svc.effect, () => (
        <ul>
          {items().map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(container.querySelectorAll('li').length).toBe(2);

      act(() => {
        items(['a', 'b', 'c']);
      });

      expect(container.querySelectorAll('li').length).toBe(3);

      act(() => {
        cleanup!();
      });
    });

    it('should support JSX with multiple elements', () => {
      const svc = createTestSignalSvc();
      const show = svc.signal(true);

      const ref = renderReact(svc.effect, () => (
        <>
          <header>Header</header>
          {show() && <main>Content</main>}
          <footer>Footer</footer>
        </>
      ));

      let cleanup: () => void;
      act(() => {
        cleanup = ref(container);
      });

      expect(container.querySelector('main')).not.toBeNull();

      act(() => {
        show(false);
      });

      expect(container.querySelector('main')).toBeNull();

      act(() => {
        cleanup!();
      });
    });
  });
});

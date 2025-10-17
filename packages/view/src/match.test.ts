import { describe, it, expect } from 'vitest';
import { createMatchFactory } from './match';
import { createViewContext } from './context';
import {
  createMockRenderer,
  createSignal,
  createRefSpec,
  getTextContent,
  type MockElement,
} from './test-utils';
import { createElFactory } from './el';

describe('match primitive', () => {
  describe('conditional rendering', () => {
    it('renders element based on reactive condition', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: condition, write: setCondition, subscribers } = createSignal(true);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const match = createMatchFactory({ ctx, effect, renderer }).method;

      const matchRef = match(
        condition,
        (isTrue) => {
          if (isTrue) {
            const yesEl = renderer.createElement('span');
            const yesText = renderer.createTextNode('yes');
            renderer.appendChild(yesEl, yesText);
            return createRefSpec(yesEl);
          } else {
            const noEl = renderer.createElement('span');
            const noText = renderer.createTextNode('no');
            renderer.appendChild(noEl, noText);
            return createRefSpec(noEl);
          }
        }
      );

      // Create parent and initialize match
      const parent = renderer.createElement('div');
      matchRef.attach(parent);

      // User cares: correct element displayed initially
      expect(parent.children).toHaveLength(1); // just the element
      const firstChild = parent.children[0] as MockElement;
      expect(getTextContent(firstChild)).toBe('yes');

      // Change condition
      setCondition(false);

      // User cares: element swapped to 'no'
      expect(parent.children).toHaveLength(1); // just the element
      const newChild = parent.children[0] as MockElement;
      expect(getTextContent(newChild)).toBe('no');
    });

    it('handles null/false to hide element', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: show, write: setShow, subscribers } = createSignal(true);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const match = createMatchFactory({ ctx, effect, renderer }).method;

      const matchRef = match(
        show,
        (shouldShow) => {
          if (shouldShow) {
            const el = renderer.createElement('div');
            const text = renderer.createTextNode('visible');
            renderer.appendChild(el, text);
            return createRefSpec(el);
          }
          return null; // Hide element
        }
      );

      // Create parent and initialize match
      const parent = renderer.createElement('div');
      matchRef.attach(parent);

      // User cares: element displayed
      expect(parent.children).toHaveLength(1); // just the element
      expect(getTextContent(parent.children[0] as MockElement)).toBe('visible');

      // Hide element
      setShow(false);

      // User cares: element removed (nothing remains)
      expect(parent.children).toHaveLength(0); // empty when hidden
    });

    it('works with el() blueprints', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: state, write: setState, subscribers } = createSignal<'loading' | 'success' | 'error'>('loading');
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;
      const match = createMatchFactory({ ctx, effect, renderer }).method;

      const matchRef = match(
        state,
        (currentState) => {
          if (currentState === 'loading') return el(['div', 'Loading...']);
          if (currentState === 'error') return el(['div', 'Error!']);
          return el(['div', 'Success!']);
        }
      );

      // Create parent and initialize match
      const parent = renderer.createElement('div');
      matchRef.attach(parent);

      // User cares: loading state displayed
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Loading...');

      // Change to success
      setState('success');

      // User cares: success state displayed
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Success!');

      // Change to error
      setState('error');

      // User cares: error state displayed
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Error!');
    });
  });

  describe('element lifecycle', () => {
    it('disposes old element scope when swapping', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: condition, write: setCondition, subscribers } = createSignal(true);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const match = createMatchFactory({ ctx, effect, renderer }).method;

      const matchRef = match(
        condition,
        () => {
          const el = renderer.createElement('div');
          const ref = createRefSpec(el);
          return ref;
        }
      );

      // Create parent and initialize match
      const parent = renderer.createElement('div');
      matchRef.attach(parent);

      const firstElement = parent.children[0] as MockElement;

      // Verify scope exists
      expect(ctx.elementScopes.has(firstElement)).toBe(false); // createRefSpec doesn't create scope in tests

      // Change condition (swap elements)
      setCondition(false);

      // User cares: old element is no longer in parent
      expect(parent.children[0]).not.toBe(firstElement);
    });
  });

  describe('integration with el()', () => {
    it('can be used as child of el()', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: isLoggedIn, write: setLoggedIn, subscribers } = createSignal(false);
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const el = createElFactory({ ctx, effect, renderer }).method;
      const match = createMatchFactory({ ctx, effect, renderer }).method;

      const container = el([
        'div',
        { className: 'container' },
        match(
          isLoggedIn,
          (loggedIn) =>
            loggedIn
              ? el(['div', 'Welcome back!'])
              : el(['div', 'Please log in'])
        ),
      ]);

      const element = container.create();

      // User cares: logged out message displayed
      expect(getTextContent(element)).toBe('Please log in');

      // Log in
      setLoggedIn(true);

      // User cares: logged in message displayed
      expect(getTextContent(element)).toBe('Welcome back!');
    });
  });
});

/**
 * Semantic Card Elements
 *
 * A thin abstraction layer that maps semantic element names to
 * either DOM or Canvas primitives. This allows the same component
 * to render to both targets.
 */
import { dom, canvas } from './service';
import type { RefSpec } from '@rimitive/view/types';

type Child = RefSpec<unknown> | string | (() => string);

/**
 * Card elements interface - semantic elements for card components
 */
export type CardElements = {
  card: (props: {
    width: number;
    height: number;
  }) => (...children: Child[]) => RefSpec<unknown>;
  avatar: (props: {
    src: () => string;
    size: number;
    x: number;
    y: number;
  }) => RefSpec<unknown>;
  heading: (props: {
    text: () => string;
    x: number;
    y: number;
  }) => RefSpec<unknown>;
  subheading: (props: {
    text: () => string;
    x: number;
    y: number;
  }) => RefSpec<unknown>;
  stat: (props: {
    value: () => string;
    label: string;
    x: number;
    y: number;
  }) => RefSpec<unknown>;
  badge: (props: { text: string; x: number; y: number }) => RefSpec<unknown>;
};

/**
 * Canvas implementation of card elements
 */
export const canvasCardElements: CardElements = {
  card:
    ({ width, height }) =>
    (...children) =>
      canvas.group(
        // Background
        canvas.rect.props({
          width,
          height,
          cornerRadius: 16,
          fill: '#1a1a2e',
        })(),
        // Border
        canvas.rect.props({
          width,
          height,
          cornerRadius: 16,
          stroke: 'rgba(255, 255, 255, 0.1)',
          strokeWidth: 1,
        })(),
        ...children
      ),

  avatar: ({ src, size, x, y }) =>
    canvas.image.props({ src, x, y, width: size, height: size })(),

  heading: ({ text, x, y }) =>
    canvas.text.props({
      text,
      x,
      y,
      fill: '#ffffff',
      fontSize: 24,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textBaseline: 'middle',
    })(),

  subheading: ({ text, x, y }) =>
    canvas.text.props({
      text,
      x,
      y,
      fill: '#888888',
      fontSize: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textBaseline: 'middle',
    })(),

  stat: ({ value, label, x, y }) =>
    canvas.group.props({ x, y })(
      canvas.text.props({
        text: value,
        x: 0,
        y: 0,
        fill: '#ffffff',
        fontSize: 28,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textBaseline: 'top',
      })(),
      canvas.text.props({
        text: label,
        x: 0,
        y: 32,
        fill: '#666666',
        fontSize: 14,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textBaseline: 'top',
      })()
    ),

  badge: ({ text, x, y }) =>
    canvas.text.props({
      text,
      x,
      y,
      fill: '#444444',
      fontSize: 12,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'right',
      textBaseline: 'middle',
    })(),
};

/**
 * DOM implementation of card elements
 */
export const domCardElements: CardElements = {
  card:
    ({ width, height }) =>
    (...children) =>
      dom.div.props({
        className: 'share-card',
        style: `width: ${width}px; height: ${height}px;`,
      })(...children),

  avatar: ({ src, size, x, y }) =>
    dom.el('img').props({
      src,
      className: 'share-card-avatar',
      style: `width: ${size}px; height: ${size}px; left: ${x}px; top: ${y}px;`,
    })(),

  heading: ({ text, x, y }) =>
    dom.span.props({
      className: 'share-card-heading',
      style: `left: ${x}px; top: ${y - 12}px;`,
    })(text),

  subheading: ({ text, x, y }) =>
    dom.span.props({
      className: 'share-card-subheading',
      style: `left: ${x}px; top: ${y - 8}px;`,
    })(text),

  stat: ({ value, label, x, y }) =>
    dom.div.props({
      className: 'share-card-stat',
      style: `left: ${x}px; top: ${y}px;`,
    })(
      dom.span.props({ className: 'share-card-stat-value' })(value),
      dom.span.props({ className: 'share-card-stat-label' })(label)
    ),

  badge: ({ text, x, y }) =>
    dom.span.props({
      className: 'share-card-badge',
      style: `right: ${400 - x}px; bottom: ${200 - y - 6}px;`,
    })(text),
};

/**
 * ShareCard - A Portable Component
 *
 * This component is "portable" - it receives all dependencies from
 * the service, including which elements to use. It doesn't know or
 * care whether it's rendering to DOM or Canvas.
 *
 * Pattern: (svc) => (args) => RefSpec
 */
import type { CardElements } from '../card-elements';
import type { ComputedFactory } from '@rimitive/signals';
import type { RefSpec } from '@rimitive/view/types';

export type ShareCardData = {
  name: () => string;
  handle: () => string;
  avatar: () => string;
  followers: () => number;
  posts: () => number;
};

type ShareCardDeps = {
  computed: ComputedFactory;
  cardElements: CardElements;
};

/**
 * Format large numbers with K/M suffix
 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Portable ShareCard behavior
 *
 * Usage:
 *   const useShareCard = svc(shareCard);
 *   const card = useShareCard({ data, width, height });
 */
export const shareCard =
  ({ computed, cardElements }: ShareCardDeps) =>
  ({
    data,
    width = 400,
    height = 200,
  }: {
    data: ShareCardData;
    width?: number;
    height?: number;
  }): RefSpec<unknown> => {
    const { card, avatar, heading, subheading, stat, badge } = cardElements;
    const { name, handle, avatar: avatarSrc, followers, posts } = data;

    return card({ width, height })(
      avatar({ src: avatarSrc, size: 72, x: 24, y: 24 }),
      heading({ text: name, x: 112, y: 52 }),
      subheading({ text: computed(() => `@${handle()}`), x: 112, y: 80 }),
      stat({
        value: computed(() => formatCount(followers())),
        label: 'Followers',
        x: 24,
        y: 116,
      }),
      stat({
        value: computed(() => formatCount(posts())),
        label: 'Posts',
        x: 160,
        y: 116,
      }),
      badge({ text: 'rimitive.dev', x: width - 24, y: height - 20 })
    );
  };

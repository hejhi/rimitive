/**
 * User Profile Page - Demonstrates nested load() with streaming SSR
 *
 * This page shows how nested load() boundaries stream progressively:
 * 1. Page shell appears immediately
 * 2. Outer load() streams when user data arrives (~500ms)
 * 3. Inner load() appears (showing "Loading posts...")
 * 4. Inner load() streams when posts arrive (~800ms after user)
 *
 * Watch the page load - you'll see each piece appear as data arrives.
 */
import type { LoadState, LoadStatus } from '@rimitive/view/load';
import type { RefSpec } from '@rimitive/view/types';
import type { Service } from '../service.js';

// =============================================================================
// Data Types
// =============================================================================

type User = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  bio: string;
};

type Post = {
  id: string;
  title: string;
  preview: string;
  publishedAt: string;
};

// =============================================================================
// Simulated API Fetchers (with delays to demonstrate streaming)
// =============================================================================

/** Fetch user - 500ms delay */
async function fetchUser(id: string): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    id,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    joinedAt: 'June 2023',
    bio: 'Software engineer passionate about reactive systems and developer experience.',
  };
}

/** Fetch posts - 800ms delay (happens after user loads) */
async function fetchUserPosts(userId: string): Promise<Post[]> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return [
    {
      id: `${userId}-post-1`,
      title: 'Getting Started with Rimitive',
      preview: 'A guide to building reactive UIs with signals and effects...',
      publishedAt: '2024-01-10',
    },
    {
      id: `${userId}-post-2`,
      title: 'SSR Streaming Patterns',
      preview: 'How to structure your app for progressive rendering...',
      publishedAt: '2024-01-05',
    },
    {
      id: `${userId}-post-3`,
      title: 'Nested Data Loading',
      preview: 'When your data has dependencies on other data...',
      publishedAt: '2023-12-20',
    },
  ];
}

// =============================================================================
// UI Components
// =============================================================================

const UserHeader = (
  { el }: Service,
  user: User
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'user-header card' })(
    el('h3')(user.name),
    el('p').props({ className: 'user-email' })(user.email),
    el('p').props({ className: 'user-bio' })(user.bio),
    el('p').props({ className: 'user-joined' })(`Member since ${user.joinedAt}`)
  );

const PostList = (
  { el }: Service,
  posts: Post[]
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'posts-list' })(
    el('h3')('Recent Posts'),
    ...posts.map((post) =>
      el('article').props({ className: 'post-card' })(
        el('h4')(post.title),
        el('p')(post.preview),
        el('time')(post.publishedAt)
      )
    )
  );

const PostsLoading = ({ el }: Service): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'posts-loading skeleton' })(
    el('h3')('Recent Posts'),
    el('p')('Loading posts...')
  );

const UserLoading = ({ el }: Service): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'user-loading skeleton' })(
    el('div').props({ className: 'user-header card' })(
      el('h3')('Loading user...'),
      el('p')('...')
    )
  );

const ErrorMessage = (
  { el }: Service,
  message: string
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'error-message' })(
    el('p')(message)
  );

// =============================================================================
// Main Page Component
// =============================================================================

/**
 * UserProfile - demonstrates nested load() with streaming
 *
 * With streaming SSR, you'll see this progression:
 * 1. Shell + explanation appear instantly
 * 2. At ~500ms: User header streams in, posts show "Loading..."
 * 3. At ~1300ms: Posts stream in
 *
 * The inner load() can't start until the outer load() resolves,
 * because it needs the user ID. Streaming handles this naturally.
 */
export const UserProfile = (svc: Service) => (): RefSpec<HTMLElement> => {
  const { el, loader, match } = svc;
  const userId = 'user-123';

  return el('div').props({ className: 'page user-profile-page' })(
    el('h2')('User Profile (Nested Loading)'),
    el('p').props({ className: 'lead' })(
      'This page demonstrates nested load() with streaming. Watch the user appear first, then their posts.'
    ),

    // Outer load: fetch user (~500ms)
    loader.load(
      'user-profile',
      () => fetchUser(userId),
      (userState: LoadState<User>) =>
        match(userState.status, (status: LoadStatus) => {
          switch (status) {
            case 'pending':
              return UserLoading(svc);
            case 'error':
              return ErrorMessage(svc, `Failed to load user: ${userState.error()}`);
            case 'ready': {
              const user = userState.data()!;

              // Inner load: fetch posts (~800ms after user)
              // This load() only appears after user data arrives
              return el('div').props({ className: 'user-content' })(
                UserHeader(svc, user),

                loader.load(
                  `user-posts-${user.id}`,
                  () => fetchUserPosts(user.id),
                  (postsState: LoadState<Post[]>) =>
                    match(postsState.status, (postStatus: LoadStatus) => {
                      switch (postStatus) {
                        case 'pending':
                          return PostsLoading(svc);
                        case 'error':
                          return ErrorMessage(svc, `Failed to load posts: ${postsState.error()}`);
                        case 'ready':
                          return PostList(svc, postsState.data()!);
                      }
                    })
                )
              );
            }
          }
        })
    ),

    // Explanation (static - appears immediately)
    el('section').props({ className: 'card' })(
      el('h3')('How Nested Streaming Works'),
      el('p')('With streaming SSR, nested load() boundaries resolve progressively:'),
      el('ol')(
        el('li')('Page shell streams immediately (what you see now)'),
        el('li')('At ~500ms: User data arrives, header streams in'),
        el('li')('Inner load() is now visible, showing "Loading posts..."'),
        el('li')('At ~1300ms: Posts arrive, list streams in'),
        el('li')('Client receives data chunks as script tags, signals update reactively')
      ),
      el('p')(
        'Unlike regular async SSR (which waits for everything), streaming sends HTML progressively. '
      )
    )
  );
};

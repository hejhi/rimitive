/**
 * User Profile Page - Demonstrates nested load() calls
 *
 * This page shows how load() boundaries can be nested:
 * 1. Outer load() fetches the user
 * 2. Inner load() fetches the user's posts (depends on user ID)
 *
 * During SSR, both are resolved before HTML is sent.
 * The server resolves outer boundaries first, then discovers and resolves inner ones.
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
  bio: string;
  joinedAt: string;
};

type Post = {
  id: string;
  title: string;
  preview: string;
  publishedAt: string;
};

// =============================================================================
// Simulated API Fetchers
// =============================================================================

async function fetchUser(id: string): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    id,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    bio: 'Software engineer passionate about reactive systems and developer experience.',
    joinedAt: 'June 2023',
  };
}

async function fetchUserPosts(userId: string): Promise<Post[]> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return [
    {
      id: `${userId}-post-1`,
      title: 'Getting Started with Rimitive',
      preview: 'A guide to building reactive UIs...',
      publishedAt: '2024-01-10',
    },
    {
      id: `${userId}-post-2`,
      title: 'SSR Patterns',
      preview: 'How to structure your SSR application...',
      publishedAt: '2024-01-05',
    },
    {
      id: `${userId}-post-3`,
      title: 'Nested Data Loading',
      preview: 'When your data has dependencies...',
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
      el('h3')('Loading...'),
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
 * UserProfile - demonstrates nested load() calls
 *
 * The outer load() fetches the user. Once that resolves, the inner load()
 * fetches posts for that specific user. This pattern is common when data
 * has dependencies - you can't fetch posts until you know which user.
 */
export const UserProfile = (svc: Service) => (): RefSpec<HTMLElement> => {
  const { el, loader, match } = svc;
  const userId = 'user-123'; // In a real app, this would come from route params

  return el('div').props({ className: 'page user-profile-page' })(
    el('h2')('User Profile'),
    el('p').props({ className: 'lead' })(
      'This page demonstrates nested load() calls. The user is fetched first, then their posts.'
    ),

    // Outer load: fetch user
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

              // Inner load: fetch posts (depends on user.id)
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

    // Explanation
    el('section').props({ className: 'card' })(
      el('h3')('How Nested load() Works'),
      el('ol')(
        el('li')('Server renders the page, encounters outer load("user-profile", ...)'),
        el('li')('Server fetches user data and waits'),
        el('li')('User data arrives, ready state renders, revealing inner load("user-posts-...", ...)'),
        el('li')('Server discovers the new load() boundary and fetches posts'),
        el('li')('Both datasets are serialized and sent with the HTML'),
        el('li')('Client hydrates with all data already present - no refetching')
      )
    )
  );
};

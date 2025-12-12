import { signal, computed, resource, el, map, match, mount } from './service';
import type { Reactive } from '@rimitive/signals';

// Types for our API data
type User = { id: number; name: string; email: string };
type Post = { id: number; userId: number; title: string; body: string };

// Selected user ID - when this changes, posts will refetch
const selectedUserId = signal<number | null>(null);

// Fetch all users
const users = resource<User[]>((abortSignal) =>
  fetch('/api/users', { signal: abortSignal }).then((r) => r.json())
);

// Fetch posts for selected user - automatically refetches when selectedUserId changes
const posts = resource<Post[]>((abortSignal) => {
  const userId = selectedUserId();
  if (userId === null) {
    return Promise.resolve([]);
  }
  return fetch(`/api/posts?userId=${userId}`, { signal: abortSignal }).then(
    (r) => r.json()
  );
});

// User button component - receives a signal wrapping the user
const UserButton = (userSignal: Reactive<User>) => {
  // Use computed to derive values from the signal
  const user = userSignal;
  const isActive = computed(() => selectedUserId() === user().id);

  return el('button').props({
    className: computed(() => `user-btn ${isActive() ? 'active' : ''}`),
    onclick: () => selectedUserId(user().id),
  })(computed(() => user().name));
};

// Post item component - receives a signal wrapping the post
const PostItem = (postSignal: Reactive<Post>) =>
  el('div').props({ className: 'post' })(
    el('h3')(computed(() => postSignal().title)),
    el('p')(computed(() => postSignal().body))
  );

// Loading indicator
const Loading = (message: string) =>
  el('div').props({ className: 'loading' })(message);

// Error display
const ErrorDisplay = (error: unknown) =>
  el('div').props({ className: 'error' })(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );

// Main app
const App = () =>
  el('div')(
    el('h1')('Rimitive Resource Example'),

    // Users section
    el('div').props({ className: 'card' })(
      el('h2')('Users'),
      match(users, (state) => {
        switch (state.status) {
          case 'pending':
            return Loading('Loading users...');
          case 'error':
            return ErrorDisplay(state.error);
          case 'ready':
            return el('div').props({ className: 'user-list' })(
              map(state.value, (u) => u.id, UserButton)
            );
        }
      })
    ),

    // Posts section
    el('div').props({ className: 'card' })(
      el('h2')('Posts'),
      match(selectedUserId, (userId) =>
        userId === null
          ? el('p')('Select a user to see their posts')
          : match(posts, (state) => {
              switch (state.status) {
                case 'pending':
                  return Loading('Loading posts...');
                case 'error':
                  return ErrorDisplay(state.error);
                case 'ready':
                  return state.value.length === 0
                    ? el('p')('No posts found')
                    : el('div')(map(state.value, (p) => p.id, PostItem));
              }
            })
      )
    )
  );

// Mount the app
const app = mount(App());
document.querySelector('#app')?.appendChild(app.element!);

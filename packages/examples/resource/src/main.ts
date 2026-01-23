import { signal, computed, resource, el, map, match, mount } from './service';
import type { Reactive } from '@rimitive/signals';

// Types for our API data
type User = { id: number; name: string; email: string };
type Post = { id: number; userId: number; title: string; body: string };

// User button component - receives a signal wrapping the user
const UserButton = (
  userSignal: Reactive<User>,
  selectedUserId: Reactive<number | null>,
  onSelect: (id: number) => void
) => {
  const isActive = computed(() => selectedUserId() === userSignal().id);

  return el('button').props({
    className: computed(() => `user-btn ${isActive() ? 'active' : ''}`),
    onclick: () => onSelect(userSignal().id),
  })(computed(() => userSignal().name));
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

// Main app - resources are created inside the component and disposed on cleanup
const App = () => {
  // Selected user ID - when this changes, posts will refetch
  const selectedUserId = signal<number | null>(null);

  // Fetch all users - created inside component, disposed on cleanup
  const users = resource<User[]>((abortSignal) =>
    fetch('/api/users', { signal: abortSignal }).then((r) => r.json())
  );

  // Fetch posts for selected user - uses `enabled` option to only fetch when user selected
  // The resource stays idle until a user is selected, then refetches when selection changes
  const posts = resource<Post[]>(
    (abortSignal) =>
      fetch(`/api/posts?userId=${selectedUserId()}`, { signal: abortSignal }).then(
        (r) => r.json()
      ),
    { enabled: () => selectedUserId() !== null }
  );

  // Cleanup function to dispose resources when component unmounts
  const cleanup = () => {
    users.dispose();
    posts.dispose();
  };

  return el('div').ref(() => cleanup)(
    el('h1')('Rimitive Resource Example'),

    // Users section
    el('div').props({ className: 'card' })(
      el('h2')('Users'),
      match(users, (state) => {
        switch (state.status) {
          case 'idle':
            return null; // Users resource is always enabled
          case 'pending':
            return Loading('Loading users...');
          case 'error':
            return ErrorDisplay(state.error);
          case 'ready':
            return el('div').props({ className: 'user-list' })(
              map(state.value, (u) => u.id, (userSignal) =>
                UserButton(userSignal, selectedUserId, (id) => selectedUserId(id))
              )
            );
        }
      })
    ),

    // Posts section - uses resource state directly (idle when no user selected)
    el('div').props({ className: 'card' })(
      el('h2')('Posts'),
      match(posts, (state) => {
        switch (state.status) {
          case 'idle':
            return el('p')('Select a user to see their posts');
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
  );
};

// Mount the app
const app = mount(App());
document.querySelector('#app')?.appendChild(app.element!);

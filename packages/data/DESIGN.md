# Data Islands - Lattice SSR Architecture

## Overview

Data Islands provide automatic server-side rendering with client-side hydration through a simple HOC pattern. Components are written once and work identically on both server and client, with data automatically serialized and rehydrated.

## Core Concept

**Data Island**: A named data fetcher that executes on the server and serializes its result for client rehydration.

**HOC Pattern**: Components receive initial data through a higher-order component that handles serialization/deserialization transparently.

## API Design

### Basic Usage (Non-Parameterized)

```ts
import { createData } from '@lattice/data';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';

// Define data fetcher (no parameters)
const withUserData = createData('user', async () => {
  return await fetchCurrentUser(); // Server: runs, Client: reads serialized
});

// Wrap component with data (creates a template)
const ProfileTemplate = withUserData((user, get) =>
  // user: initial/stale data (instant display)
  // get(): refetch function (returns fresh data)
  create(({ el }) => () => {
    return el('div')(
      el('h1')(user.name)(),
      el('p')(user.bio)()
    )();
  })
);

// Server route: load data and render
app.get('/profile', async (req, res) => {
  const Profile = await ProfileTemplate.load();
  const html = renderToString(mount(Profile));
  res.send(html + injectDataScript());
});
```

### Parameterized Usage (Recommended)

For route-based data fetching with parameters:

```ts
// Define parameterized data fetcher
const withUserData = createData('user', async (userId: string) => {
  return await fetchUser(userId); // Fetcher accepts parameters
});

// Wrap component (creates a template)
const ProfileTemplate = withUserData((user, get) =>
  create(({ el }) => () => {
    return el('div')(
      el('h1')(user.name)(),
      el('p')(user.bio)()
    )();
  })
);

// Server route: load with route params
app.get('/profile/:id', async (req, res) => {
  const Profile = await ProfileTemplate.load(req.params.id);
  const html = renderToString(mount(Profile));
  res.send(html + injectDataScript());
});

// Client: load with same params (data comes from serialized registry)
const Profile = await ProfileTemplate.load(userId);
mount(Profile);
```

**Key insight**: `.load(params)` fetches the data (server) or reads from registry (client) and returns the ready-to-use component.

### With Runtime Props

Components can combine data island props with runtime props:

```ts
const withCounterData = createData('counter', async (initialValue: number) => {
  return { initialCount: initialValue };
});

const CounterTemplate = withCounterData((data, get) =>
  create(({ el, signal }) => (multiplier: number) => {
    // data: from data island (fetched via .hydrate())
    // multiplier: from call site (runtime prop)
    const count = signal(data.initialCount * multiplier);

    return el('button', {
      onClick: () => count(count() + 1)
    })(`Count: ${count}`)();
  })
);

// Server: load with param
const Counter = await CounterTemplate.load(10);

// Usage: pass runtime props
const App = create(({ el }) => () => {
  return el('div')(
    Counter(2),  // Pass multiplier, data already fetched
    Counter(3)   // Same data, different multiplier
  )();
});
```

### Multiple Data Islands

Components can be wrapped with multiple data sources:

```ts
const withUser = createData('user', (userId: string) => fetchUser(userId));
const withTheme = createData('theme', () => fetchTheme());

const HeaderTemplate = withUser((user, getUser) =>
  withTheme((theme, getTheme) =>
    create(({ el }) => () => {
      return el('header', { className: theme.headerClass })(
        `Welcome ${user.name}`
      )();
    })
  )
);

// Load nested islands - each .load() call is sequential
app.get('/dashboard/:userId', async (req, res) => {
  // Load outer island first (user)
  const HeaderWithUser = await HeaderTemplate.load(req.params.userId);
  // Load inner island (theme) - returns final component
  const Header = await HeaderWithUser.load();

  const html = renderToString(mount(Header));
  res.send(html);
});
```

**Note**: Nested islands require sequential `.load()` calls. For parallel fetching, use separate islands.

## Type Safety

Data island types flow through to component props:

```ts
type User = { name: string; bio: string };

const withUserData = createData('user', async (): Promise<User> => {
  return await fetchUser();
});

// ✅ Type-safe: user parameter must be User type
const Profile = withUserData((user: User, get: () => Promise<User>) =>
  create(({ el }) => () => {
    user.name; // OK
    user.email; // ❌ Error: Property 'email' does not exist on type 'User'
  })
);

// ✅ Type-safe with additional props
const Greeting = withUserData((user: User, get: () => Promise<User>) =>
  create(({ el }) => (title: string) => {
    return el('h1')(`${title}, ${user.name}`)();
  })
);

Greeting("Hello"); // OK
Greeting(123);     // ❌ Error: Argument of type 'number' is not assignable to parameter of type 'string'
```

## Execution Flow

### Server-Side (SSR)

1. **Data Fetching**: All `createData()` fetchers execute in parallel
2. **Registry Population**: Results stored in global registry: `{ "user": {...}, "counter": {...} }`
3. **Component Rendering**: Components render with fetched data
4. **Serialization**: Registry serialized to `<script>window.__LATTICE_DATA__={...}</script>`
5. **HTML Output**: Complete HTML with embedded data

### Client-Side (Hydration)

1. **Registry Rehydration**: Parse `window.__LATTICE_DATA__` into registry
2. **Data Island Lookup**: `createData()` reads from registry instead of executing fetcher
3. **Component Mounting**: Components mount with rehydrated data
4. **Interactive**: Signals and event handlers become active

### Diagram

```
┌─────────────┐
│   Server    │
└─────────────┘
      │
      │ 1. Execute fetchers
      ▼
  ┌─────────────────┐
  │ Data Registry   │
  │ {              │
  │   user: {...}  │
  │   counter: 0   │
  │ }              │
  └─────────────────┘
      │
      │ 2. Render components
      ▼
  ┌─────────────────┐
  │  HTML + Data    │
  │  <script>       │
  │  window.__DATA  │
  │  </script>      │
  └─────────────────┘
      │
      │ 3. Send to client
      ▼
┌─────────────┐
│   Client    │
└─────────────┘
      │
      │ 4. Parse data
      ▼
  ┌─────────────────┐
  │ Data Registry   │
  │ (rehydrated)    │
  └─────────────────┘
      │
      │ 5. Mount components
      ▼
  ┌─────────────────┐
  │  Interactive    │
  │  Components     │
  └─────────────────┘
```

## Implementation Details

### Data Registry

Global singleton that tracks all data islands:

```ts
class DataRegistry {
  private data = new Map<string, unknown>();
  private promises = new Map<string, Promise<unknown>>();

  async register(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
    if (this.data.has(key)) return this.data.get(key);
    if (this.promises.has(key)) return this.promises.get(key);

    const promise = fetcher();
    this.promises.set(key, promise);

    const result = await promise;
    this.data.set(key, result);
    this.promises.delete(key);

    return result;
  }

  serialize(): string {
    return JSON.stringify(Object.fromEntries(this.data));
  }

  hydrate(json: string): void {
    const parsed = JSON.parse(json);
    for (const [key, value] of Object.entries(parsed)) {
      this.data.set(key, value);
    }
  }
}
```

### createData Implementation

```ts
export function createData<TParams extends any[], TData>(
  key: string,
  fetcher: (...params: TParams) => Promise<TData>
) {
  return <TComponent extends (...args: any[]) => any>(
    factory: (data: TData, get: () => Promise<TData>) => TComponent
  ) => {
    return {
      async load(...params: TParams): Promise<TComponent> {
        // Generate unique key from params
        const cacheKey = params.length > 0
          ? `${key}-${JSON.stringify(params)}`
          : key;

        // Fetch data if not in registry
        let data = getRegistry().get<TData>(cacheKey);
        if (!data) {
          data = await getRegistry().register(cacheKey, () => fetcher(...params));
        }

        // Create refetch function
        const get = async (): Promise<TData> => {
          if (typeof window === 'undefined') {
            // Server: return same data (no refetch)
            return data!;
          }

          // Client: actually refetch (no caching)
          const fresh = await fetcher(...params);
          getRegistry().set(cacheKey, fresh);
          return fresh;
        };

        // Create and return component with injected data
        return factory(data, get);
      }
    };
  };
}
```

### SSR Integration

The SSR preset automatically handles serialization:

```ts
export const createSSRApi = (signals) => {
  // ... existing setup

  const mount = <TElement>(spec: SealedSpec<TElement>) => {
    const result = spec.create(views);

    // After mounting, inject serialized data
    if (typeof window === 'undefined') {
      // Server: serialize registry
      const script = `<script>window.__LATTICE_DATA__=${getRegistry().serialize()}</script>`;
      // Append to result somehow (TBD)
    }

    return result;
  };
};
```

## Benefits

### 1. Write Once, Run Everywhere
Components are defined once and work identically on server and client.

### 2. Automatic Optimization
Only components with data islands are hydrated. Static components remain static HTML.

### 3. Type Safety
Full TypeScript inference from fetcher to component props.

### 4. Zero Boilerplate
No manual serialization, no hydration markers, no client/server split.

### 5. Composable
Data islands compose naturally with HOCs.

### 6. Framework Agnostic
Works with any Lattice renderer (DOM, linkedom, future renderers).

## Comparison with Other Frameworks

### vs Next.js Server Components
- **Similar**: Data fetching at component level
- **Different**: No separate server/client component types, one codebase
- **Advantage**: Simpler mental model, no bundler magic

### vs Qwik Resumability
- **Similar**: Serializes state for client rehydration
- **Different**: Explicit data islands vs automatic serialization
- **Advantage**: More predictable, easier to reason about

### vs Astro Islands
- **Similar**: Island architecture for partial hydration
- **Different**: Framework-integrated vs manual island marking
- **Advantage**: Type-safe data flow, HOC composition

## Data Freshness Patterns

The `get()` function provides explicit control over data freshness:

### Static (Never Refetch)
```ts
const Footer = withFooter((data, get) =>
  create(({ el }) => () => {
    return el('footer')(data.copyright)(); // Never call get()
  })
);
```

### Auto-Refresh on Mount
```ts
const Inventory = withInventory((data, get) =>
  create(({ el, signal, effect }) => () => {
    const stock = signal(data.stock); // Show stale immediately

    effect(() => {
      get().then(fresh => stock(fresh.stock)); // Fetch fresh on mount
    });

    return el('p')(`${stock} in stock`)();
  })
);
```

### Polling
```ts
const LivePrice = withPrice((data, get) =>
  create(({ el, signal, effect, onCleanup }) => () => {
    const price = signal(data.price);

    effect(() => {
      const interval = setInterval(async () => {
        const fresh = await get();
        price(fresh.price);
      }, 5000); // Poll every 5s

      onCleanup(() => clearInterval(interval));
    });

    return el('p')(`$${price}`)();
  })
);
```

### User-Triggered Refresh
```ts
const Comments = withComments((data, get) =>
  create(({ el, signal }) => () => {
    const comments = signal(data);

    return el('div')(
      ...comments().map(c => Comment(c)),
      el('button', {
        onClick: async () => comments(await get())
      })('Load New Comments')()
    )();
  })
);
```

### Behavior

- **Server**: `get()` returns the same as `data` (no actual refetch)
- **Client**: `get()` runs the fetcher again (always fresh, no caching)
- **No caching**: Each `get()` call performs a new fetch

This gives developers explicit control with zero magic.

## Data Mutations

Data islands are **read-only** - they handle fetching and serialization, not mutations. Mutations are handled by the client through regular API calls:

```ts
const withTodoList = createData('todos', fetchTodos);

const TodoList = withTodoList((todos, get) =>
  create(({ el, signal }) => () => {
    const items = signal(todos);

    const addTodo = async (text: string) => {
      // 1. Perform mutation via regular API call
      await fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ text })
      });

      // 2. Refetch to get fresh data
      const fresh = await get();
      items(fresh);
    };

    return el('div')(
      ...items().map(todo => TodoItem(todo)),
      el('button', {
        onClick: () => addTodo('New todo')
      })('Add Todo')()
    )();
  })
);
```

**Why no built-in mutations?**

1. **Simplicity**: Data islands focus on one thing - fetching and serializing data
2. **Flexibility**: Developers can use any API client (fetch, axios, tRPC, etc.)
3. **No magic**: Explicit `get()` calls make it clear when data is refetched
4. **Composability**: Mutations can update multiple data islands:

```ts
const deleteTodo = async (id: string) => {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' });

  // Refetch multiple affected data islands
  const [todos, stats] = await Promise.all([
    getTodos(),
    getStats()
  ]);

  todoList(todos);
  todoStats(stats);
};
```

This keeps the framework lean while giving developers full control over mutation logic.

## Open Questions

1. **Error Handling**: What happens if a fetcher fails?
   - Server: Show error boundary?
   - Client: Retry fetch or use fallback?

2. **Build Tool Integration**: How to optimize bundles?
   - Strip server-only code from client bundle?
   - Generate island manifest?

3. **Nested/Relational Data**: How to handle data that depends on other data?

## Nested/Relational Data

What happens when one piece of data depends on another?

### The Problem

```ts
// I need to fetch user first
const withUser = createData('user', async () => {
  return await fetchUser(); // { id: 123, name: "Alice" }
});

// Then fetch their posts using their ID
const withPosts = createData('posts', async () => {
  // ❌ How do I get the user ID here?
  return await fetchPosts(userId);
});
```

### Solution 1: Component-Level Composition

The simplest approach - fetch sequentially at the component level:

```ts
const withUser = createData('user', fetchUser);

const Profile = withUser((user, getUser) =>
  create(({ el, signal, effect }) => () => {
    const posts = signal([]);

    effect(() => {
      // Fetch posts using user.id
      fetchPosts(user.id).then(posts);
    });

    return el('div')(
      el('h1')(user.name)(),
      ...posts().map(post => Post(post))
    )();
  })
);
```

**Pros**: Simple, explicit, data flow is clear
**Cons**: Posts aren't serialized (only user data is)

### Solution 2: Parameterized Data Islands

Make the fetcher accept parameters:

```ts
// Create a parameterized data island factory
const createPostsData = (userId: string) =>
  createData(`posts-${userId}`, () => fetchPosts(userId));

const Profile = withUser((user, getUser) => {
  // Create posts island dynamically with user ID
  const withPosts = createPostsData(user.id);

  return withPosts((posts, getPosts) =>
    create(({ el }) => () => {
      return el('div')(
        el('h1')(user.name)(),
        ...posts.map(post => Post(post))
      )();
    })
  );
});
```

**Pros**: Both user and posts are serialized
**Cons**: More complex, dynamic island creation

### Solution 3: URL Parameters (Recommended)

Use route parameters instead of dependent data:

```ts
// Define parameterized islands
const withUser = createData('user', (userId: string) => fetchUser(userId));
const withPosts = createData('posts', (userId: string) => fetchPosts(userId));

// Create component template
const ProfileTemplate = withUser((user, getUser) =>
  withPosts((posts, getPosts) =>
    create(({ el }) => () => {
      return el('div')(
        el('h1')(user.name)(),
        ...posts.map(post => Post(post))
      )();
    })
  )
);

// Server route: load both islands with same param
app.get('/profile/:id', async (req, res) => {
  const userId = req.params.id;

  // Load both islands (fetches run in parallel internally)
  const ProfileWithUser = await ProfileTemplate.load(userId);
  const Profile = await ProfileWithUser.load(userId);

  const html = renderToString(mount(Profile));
  res.send(html + injectDataScript());
});
```

**Pros**: Clean, both serialized, predictable
**Cons**: Sequential load calls (parallel fetch optimization possible)

### Recommendation

For most cases, **Solution 3 (URL Parameters)** is cleanest:
- Data islands stay independent
- Can fetch in parallel
- Natural for server-side rendering (URL is known)
- Works well with routing

For truly dependent data, **Solution 1 (Component-Level)** is simplest:
- Clear data flow
- Easy to understand
- Only fetch what's needed

**Solution 2** is an escape hatch for complex cases.

### Example: User Profile Page

```ts
// Define parameterized data islands
const withUser = createData('user', (userId: string) => fetchUser(userId));
const withPosts = createData('posts', (userId: string) => fetchPosts(userId));
const withFollowers = createData('followers', (userId: string) => fetchFollowers(userId));

// Create component template with nested islands
const ProfileTemplate = withUser((user, getUser) =>
  withPosts((posts, getPosts) =>
    withFollowers((followers, getFollowers) =>
      create(({ el }) => () => {
        return el('div')(
          el('h1')(user.name)(),
          el('p')(`${followers.length} followers`)(),
          PostList(posts)
        )();
      })
    )
  )
);

// Server route: load all islands sequentially
app.get('/profile/:id', async (req, res) => {
  const userId = req.params.id;

  const step1 = await ProfileTemplate.load(userId); // Fetches user
  const step2 = await step1.load(userId);           // Fetches posts
  const Profile = await step2.load(userId);         // Fetches followers

  const html = renderToString(mount(Profile));
  res.send(html + injectDataScript());
});
```

**Note**: While load calls are sequential, the actual fetches can be parallelized internally by the registry (each unique key+params combination is fetched only once).

This keeps islands independent while handling relational data naturally.

## Next Steps

1. Implement `createData()` and data registry
2. Add serialization to SSR preset
3. Build example app demonstrating pattern
4. Add error boundaries and loading states
5. Explore build tool optimizations

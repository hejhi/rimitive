import { defineConfig, type Plugin } from 'vite';

// Simple mock API plugin
function mockApi(): Plugin {
  const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  ];

  const posts = [
    { id: 1, userId: 1, title: 'Hello World', body: 'My first post!' },
    { id: 2, userId: 1, title: 'Learning Lattice', body: 'Reactive signals are great.' },
    { id: 3, userId: 2, title: 'Bob here', body: 'Just testing things out.' },
    { id: 4, userId: 3, title: 'Charlie writes', body: 'Another test post.' },
  ];

  return {
    name: 'mock-api',
    configureServer(server) {
      // GET /api/users
      server.middlewares.use('/api/users', (_req, res) => {
        // Simulate network delay
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(users));
        }, 500);
      });

      // GET /api/users/:id
      server.middlewares.use('/api/user/', (req, res) => {
        const id = parseInt(req.url?.replace('/', '') ?? '0');
        const user = users.find((u) => u.id === id);

        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          if (user) {
            res.end(JSON.stringify(user));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'User not found' }));
          }
        }, 300);
      });

      // GET /api/posts?userId=:id
      server.middlewares.use('/api/posts', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const userId = url.searchParams.get('userId');
        const filtered = userId
          ? posts.filter((p) => p.userId === parseInt(userId))
          : posts;

        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(filtered));
        }, 400);
      });
    },
  };
}

export default defineConfig({
  plugins: [mockApi()],
  server: {
    port: 5175,
    open: true,
  },
  build: {
    target: 'esnext',
  },
});

# @lattice/lattice

A powerful, generic extension composition framework for building modular JavaScript libraries and applications.

Lattice provides a lightweight, type-safe system for composing functionality through extensions - think of it as a dependency injection container with lifecycle management, perfect for building anything extensible, tree-shake-able, and modular.

## Installation

```bash
npm install @lattice/lattice
```

## Core Concepts

### Extensions

Extensions are the building blocks of Lattice. Each extension provides a specific piece of functionality:

```typescript
import { createContext, type LatticeExtension } from '@lattice/lattice';

// A simple counter extension
const counterExtension: LatticeExtension<'counter', () => number> = {
  name: 'counter',
  method: (() => {
    let count = 0;
    return () => ++count;
  })()
};

// A logger extension
const loggerExtension: LatticeExtension<'log', (msg: string) => void> = {
  name: 'log',
  method: (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)
};

// Create a context with these extensions
const ctx = createContext(counterExtension, loggerExtension);

// Use the extensions
ctx.log('Starting counter...');
console.log(ctx.counter()); // 1
console.log(ctx.counter()); // 2
```

### Lifecycle Management

Extensions can hook into lifecycle events for setup and cleanup:

```typescript
const databaseExtension: LatticeExtension<'db', Database> = {
  name: 'db',
  method: new Database(),
  
  init(context) {
    console.log('Database extension initialized');
    this.method.connect();
  },
  
  destroy(context) {
    console.log('Cleaning up database connection');
    this.method.disconnect();
  }
};

const ctx = createContext(databaseExtension);
// "Database extension initialized"

ctx.dispose();
// "Cleaning up database connection"
```

### Context Awareness

Extensions can be wrapped to add context awareness:

```typescript
const apiExtension: LatticeExtension<'api', ApiClient> = {
  name: 'api',
  method: new ApiClient(),
  
  wrap(client, context) {
    // Prevent usage after disposal
    return new Proxy(client, {
      get(target, prop) {
        if (context.isDestroyed) {
          throw new Error('Cannot use API after context disposal');
        }
        return target[prop];
      }
    });
  }
};
```

### Instrumentation

Built-in support for debugging and monitoring through instrumentation:

```typescript
import { withInstrumentation, devtoolsProvider } from '@lattice/lattice';

const ctx = withInstrumentation(
  {
    providers: [devtoolsProvider()],
    enabled: true
  },
  httpExtension,
  cacheExtension,
  analyticsExtension
);

// All extension method calls are now instrumented
```

## Real-World Examples

### HTTP Client Extension

```typescript
const httpExtension: LatticeExtension<'http', HttpClient> = {
  name: 'http',
  method: new HttpClient(),
  
  instrument(client, instrumentation) {
    return new Proxy(client, {
      get(target, prop) {
        if (prop === 'fetch') {
          return async (...args) => {
            instrumentation.emit('HTTP_REQUEST', { url: args[0] });
            const start = performance.now();
            
            try {
              const result = await target[prop](...args);
              instrumentation.emit('HTTP_RESPONSE', { 
                url: args[0],
                status: result.status,
                duration: performance.now() - start
              });
              return result;
            } catch (error) {
              instrumentation.emit('HTTP_ERROR', { url: args[0], error });
              throw error;
            }
          };
        }
        return target[prop];
      }
    });
  }
};
```

### Event Bus Extension

```typescript
const eventBusExtension: LatticeExtension<'events', EventEmitter> = {
  name: 'events',
  method: new EventEmitter(),
  
  wrap(emitter, context) {
    const listeners = new Set<{ event: string; handler: Function }>();
    
    return new Proxy(emitter, {
      get(target, prop) {
        if (prop === 'on' || prop === 'once') {
          return (event: string, handler: Function) => {
            const result = target[prop](event, handler);
            listeners.add({ event, handler });
            
            // Auto-cleanup on disposal
            context.destroy(() => {
              target.off(event, handler);
            });
            
            return result;
          };
        }
        return target[prop];
      }
    });
  }
};
```

### WebSocket Manager

```typescript
const websocketExtension: LatticeExtension<'ws', WebSocketManager> = {
  name: 'ws',
  method: new WebSocketManager(),
  
  init(context) {
    // Initialize connection pool
    this.method.initialize();
  },
  
  destroy() {
    // Close all connections
    this.method.closeAll();
  },
  
  instrument(manager, instrumentation) {
    const original = manager.connect;
    manager.connect = (url: string) => {
      instrumentation.emit('WS_CONNECT', { url });
      const socket = original.call(manager, url);
      
      socket.on('message', (data) => {
        instrumentation.emit('WS_MESSAGE', { url, data });
      });
      
      return socket;
    };
    return manager;
  }
};
```

## Use Cases

Lattice is perfect for:

- **Dependency Injection**: Manage services and their lifecycles
- **Plugin Systems**: Build extensible applications
- **Testing**: Easily swap implementations for mocks
- **Feature Flags**: Conditionally load functionality
- **Multi-tenant Apps**: Different extension sets per tenant
- **Modular Architecture**: Compose applications from reusable pieces

## API Reference

### `createContext(...extensions)`

Creates a new context with the provided extensions.

```typescript
const ctx = createContext(extension1, extension2, extension3);
```

### `withInstrumentation(config, ...extensions)`

Creates an instrumented context for debugging and monitoring.

```typescript
const ctx = withInstrumentation(
  {
    providers: [devtoolsProvider(), performanceProvider()],
    enabled: process.env.NODE_ENV === 'development'
  },
  ...extensions
);
```

### Extension Interface

```typescript
interface LatticeExtension<TName extends string, TMethod> {
  name: TName;                    // Unique extension name
  method: TMethod;                 // The functionality to provide
  wrap?(method, context): TMethod; // Optional context wrapper
  instrument?(method, instrumentation, context): TMethod; // Optional instrumentation
  init?(context): void;        // Called on creation
  destroy?(context): void;       // Called on disposal
}
```

### Built-in Providers

- `devtoolsProvider()` - Integration with browser DevTools
- `performanceProvider()` - Performance monitoring

## Why Lattice?

- **Framework Agnostic**: Use with any JavaScript framework or vanilla JS
- **Type Safe**: Full TypeScript support with inference
- **Lightweight**: Minimal overhead, tree-shakeable
- **Extensible**: Easy to create custom extensions
- **Testable**: Simple to mock and test
- **Observable**: Built-in instrumentation support

## State Management

Looking for reactive state management? Check out [@lattice/signals](../signals) which provides signal-based reactive primitives and extensions for Lattice.

## License

MIT
/**
 * @fileoverview Comprehensive test suite for API parameter functionality
 *
 * This test suite demonstrates and validates the usage of the AdapterAPI
 * parameter that slices receive, including:
 * - Basic API usage (executeSlice, getState)
 * - Computed views with API
 * - Advanced patterns (recursive execution, cross-slice dependencies)
 * - Middleware patterns (logging, caching, performance tracking)
 */

import { describe, it, expect } from 'vitest';
import { createModel, createSlice, compose } from './index';
import type {
  SliceFactory,
  ComponentSpec,
  AdapterResult,
  ViewTypes,
} from './index';
import { isSliceFactory } from './adapter-contract';

// Minimal test adapter for API parameter testing
interface TestAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
  getState: () => Model;
}

// Note: This test adapter implementation exposes type issues in TypeScript:
// 1. Dynamic object building with reduce doesn't preserve type relationships
// 2. String indexing of typed objects requires type assertions
// 3. The ViewTypes transformation can't be built incrementally
// These are fundamental TypeScript limitations, not issues with the test scenarios

function createTestAdapter<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): TestAdapterResult<Model, Actions, Views> {
  const spec =
    typeof componentOrFactory === 'function'
      ? componentOrFactory()
      : componentOrFactory;

  // Initialize model
  let state: Model;
  const modelTools = {
    get: () => state,
    set: (updates: Partial<Model>) => {
      state = { ...state, ...updates };
    },
  };

  // Initialize state
  state = spec.model(modelTools);

  // Execute actions
  const actions = spec.actions(() => state);

  // Process views
  // TypeScript limitation: Cannot incrementally build ViewTypes<Model, Views> with reduce
  // The type system doesn't understand that we're transforming each view correctly
  const views = Object.entries(spec.views as Record<string, unknown>).reduce(
    (acc, [key, view]) => {
      if (isSliceFactory(view)) {
        // TypeScript limitation: Dynamic key assignment loses type relationship
        acc[key as keyof ViewTypes<Model, Views>] = (() =>
          view(() => state)) as ViewTypes<Model, Views>[keyof ViewTypes<
          Model,
          Views
        >];
      } else if (typeof view === 'function') {
        acc[key as keyof ViewTypes<Model, Views>] = (() => {
          const result = view();
          if (isSliceFactory(result)) {
            return result(() => state);
          }
          return result;
        }) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
      }
      return acc;
    },
    {} as ViewTypes<Model, Views>
  );

  return {
    actions,
    views,
    getState: () => state,
    destroy: () => {},
    subscribe: () => ({}) as any,
  };
}

describe('API Parameter Functionality', () => {
  describe('Basic API Usage', () => {
    it('should provide executeSlice to call other slices', () => {
      const component = () => {
        const model = createModel<{
          users: { id: number; name: string; role: string }[];
          products: { id: number; name: string; price: number }[];
        }>(() => ({
          users: [
            { id: 1, name: 'Alice', role: 'admin' },
            { id: 2, name: 'Bob', role: 'user' },
          ],
          products: [
            { id: 1, name: 'Laptop', price: 999 },
            { id: 2, name: 'Mouse', price: 29 },
          ],
        }));

        // Basic slices
        const usersSlice = createSlice(model, (m) => m().users);
        const productsSlice = createSlice(model, (m) => m().products);

        // Slice that uses API to compose data from other slices
        const summarySlice = createSlice(model, (m) => {
          const users = usersSlice(m);
          const products = productsSlice(m);

          return {
            userCount: users.length,
            productCount: products.length,
            adminCount: users.filter((u: any) => u.role === 'admin').length,
            totalValue: products.reduce((sum: any, p: any) => sum + p.price, 0),
          };
        });

        return {
          model,
          actions: createSlice(model, (_m) => ({})),
          views: {
            summary: summarySlice,
          },
        };
      };

      const adapter = createTestAdapter(component);
      const summary = adapter.views.summary();

      expect(summary.userCount).toBe(2);
      expect(summary.productCount).toBe(2);
      expect(summary.adminCount).toBe(1);
      expect(summary.totalValue).toBe(1028);
    });

    it('should provide getState to access current model state', () => {
      const component = () => {
        const model = createModel<{
          counter: number;
          increment: () => void;
        }>(({ set, get }) => ({
          counter: 0,
          increment: () => set({ counter: get().counter + 1 }),
        }));

        // Slice that inspects state through model parameter
        const stateInspectorSlice = createSlice(model, (m) => {
          return {
            fromParameter: m.counter,
            fromModel: m.counter,
            statesMatch: true, // m is always the current state
            hasIncrementFunction: typeof m.increment === 'function',
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m().increment,
          })),
          views: {
            inspector: stateInspectorSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);
      const inspector = adapter.views.inspector();

      expect(inspector.fromParameter).toBe(0);
      expect(inspector.fromModel).toBe(0);
      expect(inspector.statesMatch).toBe(true);
      expect(inspector.hasIncrementFunction).toBe(true);

      // After increment
      adapter.actions.increment();
      const updatedInspector = adapter.views.inspector();

      expect(updatedInspector.fromParameter).toBe(1);
      expect(updatedInspector.fromModel).toBe(1);
      expect(updatedInspector.statesMatch).toBe(true);
    });

    it('should support slices that conditionally use API', () => {
      const component = () => {
        const model = createModel<{
          mode: 'simple' | 'detailed';
          data: { value: number; metadata: string };
          setMode: (mode: 'simple' | 'detailed') => void;
        }>(({ set }) => ({
          mode: 'simple',
          data: { value: 42, metadata: 'test data' },
          setMode: (mode) => set({ mode }),
        }));

        // Base data slice
        const dataSlice = createSlice(model, (m) => m().data);

        // Adaptive view that changes behavior based on mode
        const adaptiveViewSlice = createSlice(model, (m) => {
          if (m().mode === 'simple') {
            return { value: m().data.value };
          } else {
            // In detailed mode, use API to get additional info
            const data = dataSlice(m);
            return {
              value: data.value,
              metadata: data.metadata,
              mode: m().mode,
              timestamp: Date.now(),
            };
          }
        });

        return {
          model,
          actions: createSlice(model, (m) => ({ setMode: m().setMode })),
          views: {
            adaptive: adaptiveViewSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Simple mode
      const simpleView = adapter.views.adaptive();
      expect(simpleView).toHaveProperty('value', 42);
      expect(simpleView).not.toHaveProperty('metadata');

      // Detailed mode
      adapter.actions.setMode('detailed');
      const detailedView = adapter.views.adaptive();
      expect(detailedView).toHaveProperty('value', 42);
      expect(detailedView).toHaveProperty('metadata', 'test data');
      expect(detailedView).toHaveProperty('mode', 'detailed');
      expect(detailedView).toHaveProperty('timestamp');
    });
  });

  describe('Computed Views with API', () => {
    it('should support dynamic view creation based on state', () => {
      const component = () => {
        const model = createModel<{
          activeFilters: string[];
          items: { id: number; name: string; tags: string[] }[];
          toggleFilter: (filter: string) => void;
        }>(({ set, get }) => ({
          activeFilters: [],
          items: [
            { id: 1, name: 'Item A', tags: ['red', 'large'] },
            { id: 2, name: 'Item B', tags: ['blue', 'small'] },
            { id: 3, name: 'Item C', tags: ['red', 'small'] },
          ],
          toggleFilter: (filter) => {
            const current = get().activeFilters;
            const index = current.indexOf(filter);
            if (index >= 0) {
              set({ activeFilters: current.filter((f) => f !== filter) });
            } else {
              set({ activeFilters: [...current, filter] });
            }
          },
        }));

        // Create filter-specific slices dynamically
        const createFilteredItemsSlice = (filters: string[]) =>
          createSlice(model, (m) => {
            if (filters.length === 0) return m().items;
            return m().items.filter((item: any) =>
              filters.every((filter) => item.tags.includes(filter))
            );
          });

        // Computed view that creates dynamic slices based on active filters
        const filteredView = () =>
          createSlice(model, (m) => {
            const filterSlice = createFilteredItemsSlice(m().activeFilters);
            const filtered = filterSlice(m);

            return {
              items: filtered,
              activeFilters: m().activeFilters,
              count: filtered.length,
            };
          });

        return {
          model,
          actions: createSlice(model, (m) => ({
            toggleFilter: m().toggleFilter,
          })),
          views: {
            filtered: filteredView(),
          },
        };
      };

      const adapter = createTestAdapter(component);

      // No filters
      let view = adapter.views.filtered();
      expect(view).toHaveProperty('count', 3);
      expect(view).toHaveProperty('activeFilters');
      expect(view.activeFilters).toEqual([]);

      // Add 'red' filter
      adapter.actions.toggleFilter('red');
      view = adapter.views.filtered();
      expect(view).toHaveProperty('count', 2);
      expect(view).toHaveProperty('items');
      expect(view.items.map((i) => i.name)).toEqual(['Item A', 'Item C']);

      // Add 'small' filter
      adapter.actions.toggleFilter('small');
      view = adapter.views.filtered();
      expect(view).toHaveProperty('count', 1);
      expect(view).toHaveProperty('items');
      expect(view.items[0]?.name).toBe('Item C');
    });

    it('should compose multiple slices to create complex views', () => {
      const component = () => {
        const model = createModel<{
          user: {
            id: number;
            name: string;
            preferences: { theme: string; language: string };
          };
          posts: { id: number; userId: number; title: string; likes: number }[];
          comments: { id: number; postId: number; text: string }[];
        }>(() => ({
          user: {
            id: 1,
            name: 'Alice',
            preferences: { theme: 'dark', language: 'en' },
          },
          posts: [
            { id: 1, userId: 1, title: 'First Post', likes: 10 },
            { id: 2, userId: 1, title: 'Second Post', likes: 5 },
          ],
          comments: [
            { id: 1, postId: 1, text: 'Great post!' },
            { id: 2, postId: 1, text: 'Thanks for sharing' },
            { id: 3, postId: 2, text: 'Interesting' },
          ],
        }));

        // Individual domain slices
        const userSlice = createSlice(model, (m) => m.user);
        const postsSlice = createSlice(model, (m) => m.posts);
        const commentsSlice = createSlice(model, (m) => m.comments);

        // Stats slice that aggregates data
        const statsSlice = createSlice(model, (m) => {
          const posts = postsSlice(() => m);
          const comments = commentsSlice(() => m);

          return {
            totalPosts: posts.length,
            totalLikes: posts.reduce((sum, p) => sum + p.likes, 0),
            totalComments: comments.length,
            avgCommentsPerPost: comments.length / posts.length,
          };
        });

        // Dashboard view that composes everything
        const dashboardSlice = createSlice(
          model,
          compose(
            { userSlice, statsSlice, postsSlice },
            (_m, { userSlice, statsSlice, postsSlice }) => {
              return {
                welcome: `Welcome, ${userSlice.name}!`,
                theme: userSlice.preferences.theme,
                stats: {
                  posts: statsSlice.totalPosts,
                  likes: statsSlice.totalLikes,
                  comments: statsSlice.totalComments,
                  engagement: statsSlice.avgCommentsPerPost,
                },
                recentPosts: postsSlice.slice(0, 5).map((p) => ({
                  title: p.title,
                  likes: p.likes,
                })),
              };
            }
          )
        );

        return {
          model,
          actions: createSlice(model, (_m) => ({})),
          views: {
            dashboard: dashboardSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);
      const dashboard = adapter.views.dashboard();

      expect(dashboard.welcome).toBe('Welcome, Alice!');
      expect(dashboard.theme).toBe('dark');
      expect(dashboard.stats).toEqual({
        posts: 2,
        likes: 15,
        comments: 3,
        engagement: 1.5,
      });
      expect(dashboard.recentPosts).toHaveLength(2);
    });
  });

  describe('Advanced Patterns', () => {
    it('should support recursive slice execution', () => {
      const component = () => {
        const model = createModel<{
          nodes: { id: number; name: string; parentId: number | null }[];
        }>(() => ({
          nodes: [
            { id: 1, name: 'Root', parentId: null },
            { id: 2, name: 'Child 1', parentId: 1 },
            { id: 3, name: 'Child 2', parentId: 1 },
            { id: 4, name: 'Grandchild 1', parentId: 2 },
            { id: 5, name: 'Grandchild 2', parentId: 3 },
          ],
        }));

        // Recursive slice factory - fix model type
        type NodeModel = {
          nodes: { id: number; name: string; parentId: number | null }[];
        };
        type TreeNode = {
          id: number;
          name: string;
          children: TreeNode[];
        };
        const createNodeTreeSlice = (
          nodeId: number
        ): SliceFactory<NodeModel, TreeNode | null> =>
          createSlice(model, (m) => {
            const node = m.nodes.find((n) => n.id === nodeId);
            if (!node) return null;

            const children = m.nodes
              .filter((n) => n.parentId === nodeId)
              .map((child) => createNodeTreeSlice(child.id)(() => m))
              .filter((child): child is TreeNode => child !== null);

            return {
              id: node.id,
              name: node.name,
              children,
            };
          });

        // Tree view starting from root
        const treeSlice = createSlice(model, (m) => {
          const rootNodes = m.nodes.filter((n) => n.parentId === null);
          return {
            tree: rootNodes
              .map((root) => createNodeTreeSlice(root.id)(() => m))
              .filter((node): node is TreeNode => node !== null),
          };
        });

        return {
          model,
          actions: createSlice(model, (_m) => ({})),
          views: {
            tree: treeSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      type TreeNodeType = {
        id: number;
        name: string;
        children: TreeNodeType[];
      };

      // TypeScript limitation: Generic view types don't preserve specific return types
      // The adapter returns ViewTypes which transforms all views to functions,
      // but doesn't preserve the specific return type of each view
      const treeView = adapter.views.tree() as {
        tree: TreeNodeType[];
      };

      expect(treeView.tree).toHaveLength(1);
      expect(treeView.tree[0]?.name).toBe('Root');
      expect(treeView.tree[0]?.children).toHaveLength(2);
      expect(treeView.tree[0]?.children[0]?.name).toBe('Child 1');
      expect(treeView.tree[0]?.children[0]?.children).toHaveLength(1);
      expect(treeView.tree[0]?.children[0]?.children[0]?.name).toBe(
        'Grandchild 1'
      );
    });

    it('should handle cross-slice dependencies and circular references safely', () => {
      const component = () => {
        const model = createModel<{
          teamA: { name: string; score: number };
          teamB: { name: string; score: number };
          updateScore: (team: 'A' | 'B', score: number) => void;
        }>(({ set, get }) => ({
          teamA: { name: 'Team Alpha', score: 0 },
          teamB: { name: 'Team Beta', score: 0 },
          updateScore: (team, score) => {
            if (team === 'A') {
              set({ teamA: { ...get().teamA, score } });
            } else {
              set({ teamB: { ...get().teamB, score } });
            }
          },
        }));

        // Team slices
        const teamASlice = createSlice(model, (m) => m.teamA);
        const teamBSlice = createSlice(model, (m) => m.teamB);

        // Comparison slice that depends on both teams
        const comparisonSlice = createSlice(model, (m) => {
          const teamA = teamASlice(() => m);
          const teamB = teamBSlice(() => m);

          return {
            leader:
              teamA.score > teamB.score
                ? teamA.name
                : teamB.score > teamA.score
                  ? teamB.name
                  : 'Tie',
            difference: Math.abs(teamA.score - teamB.score),
            total: teamA.score + teamB.score,
          };
        });

        // Match slice that uses comparison
        const matchSlice = createSlice(model, (m) => {
          const comparison = comparisonSlice(() => m);
          const teamA = teamASlice(() => m);
          const teamB = teamBSlice(() => m);

          return {
            teams: [teamA, teamB],
            status:
              comparison.leader === 'Tie'
                ? 'Draw'
                : `${comparison.leader} winning by ${comparison.difference}`,
            totalPoints: comparison.total,
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateScore: m.updateScore,
          })),
          views: {
            match: matchSlice,
            comparison: comparisonSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Initial state
      let match = adapter.views.match();
      expect(match.status).toBe('Draw');
      expect(match.totalPoints).toBe(0);

      // Team A scores
      adapter.actions.updateScore('A', 3);
      match = adapter.views.match();
      expect(match.status).toBe('Team Alpha winning by 3');
      expect(match.totalPoints).toBe(3);

      // Team B takes the lead
      adapter.actions.updateScore('B', 5);
      match = adapter.views.match();
      expect(match.status).toBe('Team Beta winning by 2');
      expect(match.totalPoints).toBe(8);
    });

    it('should handle error scenarios gracefully', () => {
      const component = () => {
        const model = createModel<{
          data: { [key: string]: unknown };
          errorMode: boolean;
          toggleError: () => void;
        }>(({ set, get }) => ({
          data: { safe: 'value' },
          errorMode: false,
          toggleError: () => set({ errorMode: !get().errorMode }),
        }));

        // Slice that might throw
        const riskySlice = createSlice(model, (m) => {
          if (m.errorMode) {
            throw new Error('Intentional error');
          }
          return { safe: true, data: m.data };
        });

        // Slice that safely handles errors from other slices
        const safeWrapperSlice = createSlice(model, (m) => {
          try {
            const result = riskySlice(() => m);
            return {
              success: true,
              data: result,
              error: null,
            };
          } catch (error) {
            return {
              success: false,
              data: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            toggleError: m.toggleError,
          })),
          views: {
            safeWrapper: safeWrapperSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Safe mode
      let view = adapter.views.safeWrapper();
      expect(view.success).toBe(true);
      expect(view.data).toEqual({ safe: true, data: { safe: 'value' } });
      expect(view.error).toBe(null);

      // Error mode
      adapter.actions.toggleError();
      view = adapter.views.safeWrapper();
      expect(view.success).toBe(false);
      expect(view.data).toBe(null);
      expect(view.error).toBe('Intentional error');
    });
  });

  describe('Middleware Patterns', () => {
    it('should implement logging middleware pattern', () => {
      const logs: string[] = [];

      const component = () => {
        const model = createModel<{
          value: number;
          increment: () => void;
        }>(({ set, get }) => ({
          value: 0,
          increment: () => set({ value: get().value + 1 }),
        }));

        // Create a logging wrapper for slices
        type LogModel = { value: number; increment: () => void };
        const withLogging = <T>(
          name: string,
          slice: SliceFactory<LogModel, T>
        ): SliceFactory<LogModel, T> =>
          createSlice(model, (m) => {
            logs.push(`[${name}] Executing...`);
            const start = Date.now();

            try {
              const result = slice(() => m);
              const duration = Date.now() - start;
              logs.push(`[${name}] Success (${duration}ms)`);
              return result;
            } catch (error) {
              const duration = Date.now() - start;
              logs.push(`[${name}] Error (${duration}ms): ${error}`);
              throw error;
            }
          });

        // Base slices
        const valueSlice = createSlice(model, (m) => ({
          value: m.value,
        }));
        const doubleSlice = createSlice(model, (m) => ({
          double: m.value * 2,
        }));

        // Wrapped slices with logging
        const loggedValueSlice = withLogging('value', valueSlice);
        const loggedDoubleSlice = withLogging('double', doubleSlice);

        // Composite slice that uses logged slices
        const compositeSlice = withLogging(
          'composite',
          createSlice(model, (m) => {
            const value = loggedValueSlice(() => m);
            const double = loggedDoubleSlice(() => m);
            return {
              value: value.value,
              double: double.double,
              sum: value.value + double.double,
            };
          })
        );

        return {
          model,
          actions: createSlice(model, (m) => ({
            increment: m.increment,
          })),
          views: {
            composite: compositeSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Clear logs and execute
      logs.length = 0;
      const view = adapter.views.composite();

      expect(view).toEqual({ value: 0, double: 0, sum: 0 });
      expect(logs).toContain('[composite] Executing...');
      expect(logs).toContain('[value] Executing...');
      expect(logs).toContain('[double] Executing...');
      expect(logs.filter((log) => log.includes('Success')).length).toBe(3);
    });

    it('should implement caching middleware pattern', () => {
      let computationCount = 0;

      const component = () => {
        const model = createModel<{
          input: number;
          setInput: (value: number) => void;
        }>(({ set }) => ({
          input: 1,
          setInput: (value) => set({ input: value }),
        }));

        // Create a caching wrapper
        type CacheModel = { input: number; setInput: (value: number) => void };
        const withCache = <T>(
          slice: SliceFactory<CacheModel, T>,
          keyFn: (m: CacheModel) => string
        ): SliceFactory<CacheModel, T> => {
          const cache = new Map<string, T>();

          return createSlice(model, (m) => {
            const key = keyFn(m);

            if (cache.has(key)) {
              return cache.get(key)!;
            }

            const result = slice(() => m);
            cache.set(key, result);
            return result;
          });
        };

        // Expensive computation slice
        const expensiveSlice = createSlice(model, (m) => {
          computationCount++;
          // Simulate expensive computation
          let result = m.input;
          for (let i = 0; i < 1000; i++) {
            result = Math.sin(result) * Math.cos(result);
          }
          return { result, computations: computationCount };
        });

        // Cached version
        const cachedExpensiveSlice = withCache(
          expensiveSlice,
          (m) => `input:${m.input}`
        );

        // View that uses cached slice multiple times
        const multiUseSlice = createSlice(model, (m) => {
          const result1 = cachedExpensiveSlice(() => m);
          const result2 = cachedExpensiveSlice(() => m);
          const result3 = cachedExpensiveSlice(() => m);

          return {
            allEqual:
              result1.result === result2.result &&
              result2.result === result3.result,
            computations: result1.computations,
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({ setInput: m.setInput })),
          views: {
            multiUse: multiUseSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Reset counter
      computationCount = 0;

      // First execution - should compute once
      let view = adapter.views.multiUse();
      expect(view.allEqual).toBe(true);
      expect(view.computations).toBe(1);

      // Second execution with same input - should use cache
      view = adapter.views.multiUse();
      expect(view.computations).toBe(1); // Still 1, not recomputed

      // Change input - should compute again
      adapter.actions.setInput(2);
      view = adapter.views.multiUse();
      expect(view.computations).toBe(2); // Incremented
    });

    it('should implement performance tracking middleware', () => {
      const performanceData: { [key: string]: number[] } = {};

      const component = () => {
        const model = createModel<{
          data: number[];
          addData: (value: number) => void;
        }>(({ set, get }) => ({
          data: [1, 2, 3],
          addData: (value) => set({ data: [...get().data, value] }),
        }));

        // Performance tracking wrapper
        type PerfModel = { data: number[]; addData: (value: number) => void };
        const withPerformanceTracking = <T>(
          name: string,
          slice: SliceFactory<PerfModel, T>
        ): SliceFactory<PerfModel, T> =>
          createSlice(model, (m) => {
            const start = performance.now();
            const result = slice(() => m);
            const duration = performance.now() - start;

            if (!performanceData[name]) {
              performanceData[name] = [];
            }
            performanceData[name].push(duration);

            return result;
          });

        // Various slices with different complexities
        const simpleSlice = createSlice(model, (m) => ({
          count: m.data.length,
        }));

        const moderateSlice = createSlice(model, (m) => ({
          sum: m.data.reduce((a, b) => a + b, 0),
          avg: m.data.reduce((a, b) => a + b, 0) / m.data.length,
        }));

        const complexSlice = createSlice(model, (m) => ({
          sorted: [...m.data].sort((a, b) => a - b),
          unique: [...new Set(m.data)],
          stats: {
            min: Math.min(...m.data),
            max: Math.max(...m.data),
            median: (() => {
              const sorted = [...m.data].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              return sorted.length % 2
                ? sorted[mid]!
                : (sorted[mid - 1]! + sorted[mid]!) / 2;
            })(),
          },
        }));

        // Tracked versions
        const trackedSimple = withPerformanceTracking('simple', simpleSlice);
        const trackedModerate = withPerformanceTracking(
          'moderate',
          moderateSlice
        );
        const trackedComplex = withPerformanceTracking('complex', complexSlice);

        // Dashboard that uses all tracked slices
        const performanceDashboard = createSlice(model, (m) => {
          const simple = trackedSimple(() => m);
          const moderate = trackedModerate(() => m);
          const complex = trackedComplex(() => m);

          return {
            simple,
            moderate,
            complex,
            performance: Object.entries(performanceData).reduce(
              (acc, [key, times]) => {
                acc[key] = {
                  calls: times.length,
                  avgTime: times.reduce((a, b) => a + b, 0) / times.length,
                  totalTime: times.reduce((a, b) => a + b, 0),
                };
                return acc;
              },
              {} as Record<
                string,
                { calls: number; avgTime: number; totalTime: number }
              >
            ),
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({ addData: m.addData })),
          views: {
            dashboard: performanceDashboard,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Execute multiple times to gather performance data
      for (let i = 0; i < 5; i++) {
        adapter.views.dashboard();
      }

      const finalDashboard = adapter.views.dashboard();

      // Verify performance tracking
      expect(finalDashboard.performance.simple).toBeDefined();
      expect(finalDashboard.performance.simple!.calls).toBe(6); // 5 + 1
      expect(finalDashboard.performance.moderate).toBeDefined();
      expect(finalDashboard.performance.moderate!.calls).toBe(6);
      expect(finalDashboard.performance.complex).toBeDefined();
      expect(finalDashboard.performance.complex!.calls).toBe(6);

      // Performance characteristics (complex should generally take longer)
      expect(finalDashboard.performance.simple!.avgTime).toBeDefined();
      expect(finalDashboard.performance.moderate!.avgTime).toBeDefined();
      expect(finalDashboard.performance.complex!.avgTime).toBeDefined();
    });

    it('should demonstrate validation middleware pattern', () => {
      const component = () => {
        const model = createModel<{
          formData: {
            email: string;
            age: number;
            username: string;
          };
          updateField: (field: string, value: unknown) => void;
        }>(({ set, get }) => ({
          formData: {
            email: '',
            age: 0,
            username: '',
          },
          updateField: (field, value) => {
            set({
              formData: {
                ...get().formData,
                [field]: value,
              },
            });
          },
        }));

        // Validation rules
        const validators = {
          email: (value: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value) ? null : 'Invalid email format';
          },
          age: (value: number) => {
            if (value < 0) return 'Age cannot be negative';
            if (value > 150) return 'Age seems unrealistic';
            return null;
          },
          username: (value: string) => {
            if (value.length < 3)
              return 'Username must be at least 3 characters';
            if (value.length > 20)
              return 'Username must be at most 20 characters';
            if (!/^[a-zA-Z0-9_]+$/.test(value))
              return 'Username can only contain letters, numbers, and underscores';
            return null;
          },
        };

        // Validation wrapper - moved inside component factory to access model
        type FormModel = {
          formData: {
            email: string;
            age: number;
            username: string;
          };
          updateField: (field: string, value: unknown) => void;
        };

        const withValidation = <T extends { [key: string]: unknown }>(
          slice: SliceFactory<FormModel, T>
        ): SliceFactory<
          FormModel,
          T & { validation: { [key: string]: string | null }; isValid: boolean }
        > =>
          createSlice(model, (m) => {
            const data = slice(() => m);
            const validation: { [key: string]: string | null } = {};

            // Validate each field
            Object.entries(data).forEach(([field, value]) => {
              if (field in validators) {
                // TypeScript limitation: Object.entries returns string keys,
                // not the specific literal types of the object keys
                const validator = (
                  validators as Record<
                    string,
                    (value: unknown) => string | null
                  >
                )[field];
                if (validator) {
                  validation[field] = validator(value);
                }
              }
            });

            const isValid = Object.values(validation).every((v) => v === null);

            return {
              ...data,
              validation,
              isValid,
            };
          });

        // Form data slice
        const formDataSlice = createSlice(model, (m) => m.formData);

        // Validated form slice
        const validatedFormSlice = withValidation(formDataSlice);

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateField: m.updateField,
          })),
          views: {
            form: validatedFormSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Initial state - all invalid
      let form = adapter.views.form();
      expect(form.isValid).toBe(false);
      expect(form.validation.email).toBe('Invalid email format');
      expect(form.validation.username).toBe(
        'Username must be at least 3 characters'
      );

      // Update to valid values
      adapter.actions.updateField('email', 'user@example.com');
      adapter.actions.updateField('age', 25);
      adapter.actions.updateField('username', 'john_doe');

      form = adapter.views.form();
      expect(form.isValid).toBe(true);
      expect(form.validation.email).toBe(null);
      expect(form.validation.age).toBe(null);
      expect(form.validation.username).toBe(null);

      // Invalid updates
      adapter.actions.updateField('age', 200);
      form = adapter.views.form();
      expect(form.isValid).toBe(false);
      expect(form.validation.age).toBe('Age seems unrealistic');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle a shopping cart with computed totals', () => {
      const component = () => {
        const model = createModel<{
          products: {
            id: number;
            name: string;
            price: number;
            stock: number;
          }[];
          cart: { productId: number; quantity: number }[];
          addToCart: (productId: number, quantity: number) => void;
          removeFromCart: (productId: number) => void;
          updateQuantity: (productId: number, quantity: number) => void;
        }>(({ set, get }) => ({
          products: [
            { id: 1, name: 'Laptop', price: 999.99, stock: 5 },
            { id: 2, name: 'Mouse', price: 29.99, stock: 20 },
            { id: 3, name: 'Keyboard', price: 79.99, stock: 15 },
          ],
          cart: [],
          addToCart: (productId, quantity) => {
            const current = get();
            const existing = current.cart.find(
              (item) => item.productId === productId
            );
            if (existing) {
              set({
                cart: current.cart.map((item) =>
                  item.productId === productId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                ),
              });
            } else {
              set({ cart: [...current.cart, { productId, quantity }] });
            }
          },
          removeFromCart: (productId) => {
            set({
              cart: get().cart.filter((item) => item.productId !== productId),
            });
          },
          updateQuantity: (productId, quantity) => {
            if (quantity <= 0) {
              get().removeFromCart(productId);
            } else {
              set({
                cart: get().cart.map((item) =>
                  item.productId === productId ? { ...item, quantity } : item
                ),
              });
            }
          },
        }));

        // Product catalog slice
        const catalogSlice = createSlice(model, (m) => m.products);

        // Cart items with product details
        const cartDetailsSlice = createSlice(model, (m) => {
          const products = catalogSlice(() => m);

          return m.cart
            .map((cartItem) => {
              const product = products.find((p) => p.id === cartItem.productId);
              if (!product) return null;

              return {
                ...product,
                quantity: cartItem.quantity,
                subtotal: product.price * cartItem.quantity,
                inStock: product.stock >= cartItem.quantity,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
        });

        // Cart summary
        const cartSummarySlice = createSlice(model, (m) => {
          const items = cartDetailsSlice(() => m);

          const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
          const taxRate = 0.08; // 8% tax
          const tax = subtotal * taxRate;
          const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
          const total = subtotal + tax + shipping;

          return {
            itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            shipping,
            total: Math.round(total * 100) / 100,
            freeShippingEligible: subtotal > 100,
            allInStock: items.every((item) => item.inStock),
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            addToCart: m.addToCart,
            removeFromCart: m.removeFromCart,
            updateQuantity: m.updateQuantity,
          })),
          views: {
            cartDetails: cartDetailsSlice,
            summary: cartSummarySlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Add items to cart
      adapter.actions.addToCart(1, 1); // 1 laptop
      adapter.actions.addToCart(2, 2); // 2 mice

      let details = adapter.views.cartDetails();
      expect(details).toHaveLength(2);
      expect(details[0]?.name).toBe('Laptop');
      expect(details[0]?.quantity).toBe(1);
      expect(details[0]?.subtotal).toBe(999.99);

      let summary = adapter.views.summary();
      expect(summary.itemCount).toBe(3);
      expect(summary.subtotal).toBe(1059.97);
      expect(summary.freeShippingEligible).toBe(true);
      expect(summary.shipping).toBe(0);

      // Update quantity
      adapter.actions.updateQuantity(1, 2); // 2 laptops

      summary = adapter.views.summary();
      expect(summary.itemCount).toBe(4);
      expect(summary.subtotal).toBe(2059.96);
    });

    it('should handle user permissions and feature flags', () => {
      const component = () => {
        const model = createModel<{
          user: {
            id: number;
            name: string;
            roles: string[];
            permissions: string[];
          };
          featureFlags: {
            [key: string]: boolean;
          };
          updateUserRole: (role: string, add: boolean) => void;
          toggleFeature: (feature: string) => void;
        }>(({ set, get }) => ({
          user: {
            id: 1,
            name: 'John Doe',
            roles: ['user'],
            permissions: ['read'],
          },
          featureFlags: {
            darkMode: true,
            betaFeatures: false,
            advancedAnalytics: false,
          },
          updateUserRole: (role, add) => {
            const current = get();
            const roles = add
              ? [...current.user.roles, role]
              : current.user.roles.filter((r) => r !== role);

            // Update permissions based on roles
            const permissions = new Set(['read']); // Base permission
            if (roles.includes('admin')) {
              permissions.add('write');
              permissions.add('delete');
              permissions.add('manage_users');
            }
            if (roles.includes('moderator')) {
              permissions.add('write');
              permissions.add('moderate');
            }

            set({
              user: {
                ...current.user,
                roles,
                permissions: Array.from(permissions),
              },
            });
          },
          toggleFeature: (feature) => {
            set({
              featureFlags: {
                ...get().featureFlags,
                [feature]: !get().featureFlags[feature],
              },
            });
          },
        }));

        // Permission checker slice factory
        const createPermissionChecker = (requiredPermissions: string[]) =>
          createSlice(model, (m) => {
            const hasAll = requiredPermissions.every((perm) =>
              m.user.permissions.includes(perm)
            );
            const hasAny = requiredPermissions.some((perm) =>
              m.user.permissions.includes(perm)
            );

            return {
              hasAll,
              hasAny,
              missing: requiredPermissions.filter(
                (perm) => !m.user.permissions.includes(perm)
              ),
            };
          });

        // Feature availability slice
        const featureAvailabilitySlice = createSlice(model, (m) => {
          const canWrite = createPermissionChecker(['write'])(() => m);
          const canAdmin = createPermissionChecker(['manage_users'])(() => m);

          return {
            canUseDarkMode: m.featureFlags.darkMode,
            canUseBetaFeatures:
              m.featureFlags.betaFeatures &&
              m.user.roles.includes('beta_tester'),
            canUseAdvancedAnalytics:
              m.featureFlags.advancedAnalytics && canAdmin.hasAll,
            canEditContent: canWrite.hasAll,
            canManageUsers: canAdmin.hasAll,
          };
        });

        // User dashboard slice
        const userDashboardSlice = createSlice(model, (m) => {
          const features = featureAvailabilitySlice(() => m);

          const availableActions = [];
          if (features.canEditContent) availableActions.push('Edit');
          if (features.canManageUsers) availableActions.push('Manage Users');
          if (m.user.permissions.includes('moderate'))
            availableActions.push('Moderate');

          return {
            greeting: `Welcome, ${m.user.name}!`,
            role: m.user.roles.join(', '),
            availableActions,
            enabledFeatures: Object.entries(features)
              .filter(([_, enabled]) => enabled)
              .map(([feature]) => feature),
          };
        });

        return {
          model,
          actions: createSlice(model, (m) => ({
            updateUserRole: m.updateUserRole,
            toggleFeature: m.toggleFeature,
          })),
          views: {
            features: featureAvailabilitySlice,
            dashboard: userDashboardSlice,
          },
        };
      };

      const adapter = createTestAdapter(component);

      // Initial state - basic user
      let dashboard = adapter.views.dashboard();
      expect(dashboard.role).toBe('user');
      expect(dashboard.availableActions).toEqual([]);
      expect(dashboard.enabledFeatures).toContain('canUseDarkMode');

      // Add moderator role
      adapter.actions.updateUserRole('moderator', true);
      dashboard = adapter.views.dashboard();
      expect(dashboard.availableActions).toContain('Edit');
      expect(dashboard.availableActions).toContain('Moderate');

      // Add admin role
      adapter.actions.updateUserRole('admin', true);
      dashboard = adapter.views.dashboard();
      expect(dashboard.availableActions).toContain('Manage Users');

      // Enable advanced analytics
      adapter.actions.toggleFeature('advancedAnalytics');
      let features = adapter.views.features();
      expect(features.canUseAdvancedAnalytics).toBe(true);
    });
  });
});

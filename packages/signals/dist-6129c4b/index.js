import { s as m, c as w, e as E, b as l } from "./batch-export-Dzw7_XP3.js";
import { j as v, k as R, h as j, d as N, g as G, i as B, a as U, f as k, u as L } from "./batch-export-Dzw7_XP3.js";
import { subscribe as x } from "./subscribe.js";
import { select as D } from "./select.js";
import { getEffectFromDisposer as H, isComputed as W, isEffect as $, isEffectDisposer as q, isReactive as z, isSignal as J } from "./type-guards.js";
const b = {
  name: "signal",
  method: m,
  wrap(r, e) {
    return function(o) {
      if (e.isDisposed)
        throw new Error("Cannot create signal in disposed context");
      return r(o);
    };
  },
  instrument(r, e) {
    return function(c, o) {
      const t = r(c, o), { id: n } = e.register(t, "signal", o);
      e.emit({
        type: "SIGNAL_CREATED",
        timestamp: Date.now(),
        data: {
          id: n,
          name: o,
          initialValue: c,
          contextId: e.contextId
        }
      });
      const a = Object.getPrototypeOf(t), s = a ? Object.getOwnPropertyDescriptor(a, "value") : void 0;
      if (s?.set && s?.get) {
        const d = s.set.bind(t), p = s.get.bind(t);
        Object.defineProperty(t, "value", {
          get() {
            const i = p();
            return e.emit({
              type: "SIGNAL_READ",
              timestamp: Date.now(),
              data: {
                id: n,
                name: o,
                value: i,
                contextId: e.contextId
              }
            }), i;
          },
          set(i) {
            const f = p(), u = d(i);
            return e.emit({
              type: "SIGNAL_WRITE",
              timestamp: Date.now(),
              data: {
                id: n,
                name: o,
                oldValue: f,
                newValue: i,
                contextId: e.contextId
              }
            }), u;
          },
          enumerable: s.enumerable,
          configurable: !0
        });
      }
      return t;
    };
  }
}, g = {
  name: "computed",
  method: w,
  wrap(r, e) {
    return (c, o) => {
      if (e.isDisposed)
        throw new Error("Cannot create computed in disposed context");
      const t = r(c, o);
      return e.onDispose(() => t.dispose()), t;
    };
  },
  instrument(r, e) {
    return function(c, o) {
      const t = r(c, o), { id: n } = e.register(t, "computed", o);
      e.emit({
        type: "COMPUTED_CREATED",
        timestamp: Date.now(),
        data: {
          id: n,
          name: o,
          contextId: e.contextId
        }
      });
      const a = Object.getPrototypeOf(t), s = a ? Object.getOwnPropertyDescriptor(a, "value") : void 0;
      if (s?.get) {
        const d = s.get.bind(t);
        Object.defineProperty(t, "value", {
          get() {
            e.emit({
              type: "COMPUTE_START",
              timestamp: Date.now(),
              data: {
                id: n,
                name: o,
                contextId: e.contextId
              }
            });
            const p = performance.now(), i = d(), f = performance.now() - p;
            return e.emit({
              type: "COMPUTE_END",
              timestamp: Date.now(),
              data: {
                id: n,
                name: o,
                value: i,
                duration: f,
                contextId: e.contextId
              }
            }), i;
          },
          enumerable: s.enumerable,
          configurable: !0
        });
      }
      return t;
    };
  }
}, I = {
  name: "effect",
  method: E,
  wrap(r, e) {
    return (c, o) => {
      if (e.isDisposed)
        throw new Error("Cannot create effect in disposed context");
      const t = r(c, o);
      e.onDispose(t);
      const n = () => {
        t();
      };
      return n.__effect = t.__effect, n;
    };
  },
  instrument(r, e) {
    return function(c, o) {
      let t = "";
      const a = r(() => {
        e.emit({
          type: "EFFECT_START",
          timestamp: Date.now(),
          data: {
            id: t,
            name: o,
            contextId: e.contextId
          }
        });
        const p = performance.now(), i = c(), f = performance.now() - p;
        return e.emit({
          type: "EFFECT_END",
          timestamp: Date.now(),
          data: {
            id: t,
            name: o,
            duration: f,
            hasCleanup: typeof i == "function",
            contextId: e.contextId
          }
        }), i;
      }, o);
      t = e.register(a.__effect, "effect", o).id, e.emit({
        type: "EFFECT_CREATED",
        timestamp: Date.now(),
        data: {
          id: t,
          name: o,
          contextId: e.contextId
        }
      });
      const d = () => {
        a(), e.emit({
          type: "EFFECT_DISPOSED",
          timestamp: Date.now(),
          data: {
            id: t,
            name: o,
            contextId: e.contextId
          }
        });
      };
      return d.__effect = a.__effect, d;
    };
  }
}, y = {
  name: "batch",
  method: l,
  // No wrapping needed - batch doesn't need disposal tracking
  // But we could add disposed check if desired
  wrap(r, e) {
    return (c) => {
      if (e.isDisposed)
        throw new Error("Cannot use batch in disposed context");
      return r(c);
    };
  },
  instrument(r, e) {
    let c = 0;
    return function(o) {
      const t = `batch_${++c}`;
      e.emit({
        type: "BATCH_START",
        timestamp: Date.now(),
        data: {
          id: t,
          contextId: e.contextId
        }
      });
      const n = performance.now();
      let a, s;
      try {
        a = r(o);
      } catch (p) {
        s = p;
      }
      const d = performance.now() - n;
      if (e.emit({
        type: "BATCH_END",
        timestamp: Date.now(),
        data: {
          id: t,
          duration: d,
          success: !s,
          contextId: e.contextId
        }
      }), s)
        throw s instanceof Error ? s : new Error(typeof s == "string" ? s : "Batch operation failed");
      return a;
    };
  }
};
function h(r, e) {
  return "select" in r && typeof r.select == "function" ? r.select(e) : D(r, e);
}
const C = {
  name: "select",
  method: h,
  wrap(r, e) {
    return (c, o) => {
      if (e.isDisposed)
        throw new Error("Cannot use select in disposed context");
      return r(c, o);
    };
  }
}, _ = {
  name: "subscribe",
  method: x,
  wrap(r, e) {
    return (c, o) => {
      if (e.isDisposed)
        throw new Error("Cannot use subscribe in disposed context");
      const t = r(c, o);
      return e.onDispose(t), t;
    };
  }
}, A = [
  b,
  g,
  I,
  y,
  C,
  _
];
export {
  v as activeContext,
  l as batch,
  y as batchExtension,
  w as computed,
  g as computedExtension,
  A as coreExtensions,
  R as coreFactories,
  j as createBatchFactory,
  N as createComputedFactory,
  G as createEffectFactory,
  B as createSignalAPI,
  U as createSignalFactory,
  k as createUntrackFactory,
  E as effect,
  I as effectExtension,
  H as getEffectFromDisposer,
  W as isComputed,
  $ as isEffect,
  q as isEffectDisposer,
  z as isReactive,
  J as isSignal,
  D as select,
  C as selectExtension,
  m as signal,
  b as signalExtension,
  x as subscribe,
  _ as subscribeExtension,
  L as untrack
};

function l() {
  const t = new Array(100);
  for (let r = 0; r < 100; r++)
    t[r] = {};
  return {
    currentComputed: null,
    version: 0,
    batchDepth: 0,
    batchedEffects: null,
    nodePool: t,
    poolSize: 100,
    allocations: 0,
    poolHits: 0,
    poolMisses: 0
  };
}
function c(t) {
  const r = t.source, i = t.prevTarget, e = t.nextTarget;
  i !== void 0 ? i.nextTarget = e : (r._targets = e, e === void 0 && "_flags" in r && (r._flags &= -17)), e !== void 0 && (e.prevTarget = i);
}
function f(t) {
  class r {
    __type = "signal";
    _value;
    _version = 0;
    _targets = void 0;
    _node = void 0;
    constructor(e) {
      this._value = e;
    }
    get value() {
      if (!t.currentComputed || !(t.currentComputed._flags & 4))
        return this._value;
      const e = t.currentComputed;
      let s = this._node;
      if (s !== void 0 && s.target === e)
        return s.version = this._version, this._value;
      for (s = e._sources; s; ) {
        if (s.source === this)
          return s.version = this._version, this._value;
        s = s.nextSource;
      }
      t.allocations++;
      const o = t.poolSize > 0 ? (t.poolHits++, t.nodePool[--t.poolSize]) : (t.poolMisses++, {});
      return o.source = this, o.target = e, o.version = this._version, o.nextSource = e._sources, o.nextTarget = this._targets, o.prevSource = void 0, o.prevTarget = void 0, e._sources && (e._sources.prevSource = o), e._sources = o, this._targets && (this._targets.prevTarget = o), this._targets = o, this._node = o, this._value;
    }
    set value(e) {
      if (this._value === e) return;
      this._value = e, this._version++, t.version++;
      let s = this._targets;
      for (; s; )
        s.target._notify(), s = s.nextTarget;
    }
    _refresh() {
      return !0;
    }
    set(e, s) {
      if (Array.isArray(this._value)) {
        const o = [...this._value], n = e;
        o[n] = s, this.value = o;
      } else if (typeof this._value == "object" && this._value !== null) {
        const o = e;
        this.value = { ...this._value, [o]: s };
      }
    }
    patch(e, s) {
      if (Array.isArray(this._value)) {
        const o = [...this._value], n = e, a = o[n];
        o[n] = typeof a == "object" && a !== null ? { ...a, ...s } : s, this.value = o;
      } else if (typeof this._value == "object" && this._value !== null) {
        const o = e, n = this._value[o];
        this.value = {
          ...this._value,
          [o]: typeof n == "object" && n !== null ? { ...n, ...s } : s
        };
      }
    }
    peek() {
      return this._value;
    }
  }
  return function(e) {
    return new r(e);
  };
}
function h(t) {
  class r {
    __type = "computed";
    _compute;
    _value = void 0;
    _version = 0;
    _globalVersion = -1;
    _flags = 34;
    _sources = void 0;
    _targets = void 0;
    _node = void 0;
    constructor(e) {
      this._compute = e;
    }
    get value() {
      return this._addDependency(t.currentComputed), this._refresh(), this._value;
    }
    _refresh() {
      if (this._flags &= -2, this._flags & 4)
        throw new Error("Cycle detected");
      if (this._isUpToDate())
        return !0;
      if (this._flags &= -3, this._flags |= 4, this._version > 0 && !this._checkSources())
        return this._flags &= -5, !0;
      const e = t.currentComputed;
      try {
        this._prepareSourcesTracking(), t.currentComputed = this, this._updateValue(), this._globalVersion = t.version;
      } finally {
        t.currentComputed = e, this._cleanupSources(), this._flags &= -5;
      }
      return !0;
    }
    _notify() {
      if (!(this._flags & 1)) {
        this._flags |= 3;
        let e = this._targets;
        for (; e; )
          e.target._notify(), e = e.nextTarget;
      }
    }
    dispose() {
      this._flags & 8 || (this._flags |= 8, this._disposeAllSources(), this._value = void 0);
    }
    peek() {
      return this._refresh(), this._value;
    }
    _addDependency(e) {
      if (!e || !(e._flags & 4)) return;
      const s = this._version;
      this._tryReuseNode(e, s) || this._findExistingDependency(e, s) || this._createNewDependency(e, s);
    }
    _tryReuseNode(e, s) {
      const o = this._node;
      return o !== void 0 && o.target === e ? (o.version = s, !0) : !1;
    }
    _findExistingDependency(e, s) {
      let o = e._sources;
      for (; o; ) {
        if (o.source === this)
          return o.version = s, !0;
        o = o.nextSource;
      }
      return !1;
    }
    _createNewDependency(e, s) {
      t.allocations++;
      const o = t.poolSize > 0 ? (t.poolHits++, t.nodePool[--t.poolSize]) : (t.poolMisses++, {});
      o.source = this, o.target = e, o.version = s, o.nextSource = e._sources, o.nextTarget = this._targets, o.prevSource = void 0, o.prevTarget = void 0, e._sources && (e._sources.prevSource = o), e._sources = o, this._targets ? this._targets.prevTarget = o : this._flags |= 16, this._targets = o, this._node = o;
    }
    _isUpToDate() {
      return !(this._flags & 2) && this._version > 0 && this._globalVersion === t.version;
    }
    _checkSources() {
      for (let e = this._sources; e !== void 0; e = e.nextSource) {
        const s = e.source;
        if (e.version !== s._version || !s._refresh() || e.version !== s._version)
          return !0;
      }
      return !1;
    }
    _prepareSourcesTracking() {
      for (let e = this._sources; e !== void 0; e = e.nextSource)
        e.version = -1;
    }
    _updateValue() {
      const e = this._compute(), s = e !== this._value || this._version === 0;
      return s && (this._value = e, this._version++), s;
    }
    _cleanupSources() {
      let e = this._sources, s;
      for (; e !== void 0; ) {
        const o = e.nextSource;
        e.version === -1 ? (this._removeNode(e, s), t.poolSize < 1e3 && (e.source = void 0, e.target = void 0, e.version = 0, e.nextSource = void 0, e.prevSource = void 0, e.nextTarget = void 0, e.prevTarget = void 0, t.nodePool[t.poolSize++] = e)) : s = e, e = o;
      }
    }
    _removeNode(e, s) {
      const o = e.nextSource;
      s !== void 0 ? s.nextSource = o : this._sources = o, o !== void 0 && (o.prevSource = s), c(e);
    }
    _disposeAllSources() {
      let e = this._sources;
      for (; e; ) {
        const s = e.nextSource;
        c(e), t.poolSize < 1e3 && (e.source = void 0, e.target = void 0, e.version = 0, e.nextSource = void 0, e.prevSource = void 0, e.nextTarget = void 0, e.prevTarget = void 0, t.nodePool[t.poolSize++] = e), e = s;
      }
      this._sources = void 0;
    }
  }
  return function(e) {
    return new r(e);
  };
}
function v(t) {
  return function(i) {
    const e = t.currentComputed;
    t.currentComputed = null;
    try {
      return i();
    } finally {
      t.currentComputed = e;
    }
  };
}
function d(t) {
  class r {
    __type = "effect";
    _fn;
    _flags = 2;
    _sources = void 0;
    _nextBatchedEffect = void 0;
    constructor(e) {
      this._fn = e;
    }
    _notify() {
      if (!(this._flags & 1)) {
        if (this._flags |= 3, t.batchDepth > 0) {
          this._nextBatchedEffect = t.batchedEffects || void 0, t.batchedEffects = this;
          return;
        }
        t.batchDepth++;
        try {
          this._run();
        } finally {
          if (--t.batchDepth === 0) {
            let e = t.batchedEffects;
            if (e)
              for (t.batchedEffects = null; e; ) {
                const s = e._nextBatchedEffect;
                e._nextBatchedEffect = void 0, e._run(), e = s;
              }
          }
        }
      }
    }
    _run() {
      if (this._flags & 12) return;
      this._flags = (this._flags | 4) & -4;
      let e = this._sources;
      for (; e; )
        e.version = -1, e = e.nextSource;
      const s = t.currentComputed;
      t.currentComputed = this;
      try {
        this._fn();
      } finally {
        t.currentComputed = s, this._flags &= -5, e = this._sources;
        let o;
        for (; e; ) {
          const n = e.nextSource;
          e.version === -1 ? (o ? o.nextSource = n : this._sources = n, n && (n.prevSource = o), c(e), t.poolSize < 1e3 && (e.source = void 0, e.target = void 0, e.version = 0, e.nextSource = void 0, e.prevSource = void 0, e.nextTarget = void 0, e.prevTarget = void 0, t.nodePool[t.poolSize++] = e)) : o = e, e = n;
        }
      }
    }
    dispose() {
      if (!(this._flags & 8)) {
        this._flags |= 8;
        let e = this._sources;
        for (; e; ) {
          const s = e.nextSource;
          c(e), t.poolSize < 1e3 && (e.source = void 0, e.target = void 0, e.version = 0, e.nextSource = void 0, e.prevSource = void 0, e.nextTarget = void 0, e.prevTarget = void 0, t.nodePool[t.poolSize++] = e), e = s;
        }
        this._sources = void 0;
      }
    }
  }
  return function(e) {
    let s;
    const o = new r(() => {
      s && typeof s == "function" && s(), s = e();
    });
    o._run();
    const n = () => {
      o.dispose(), s && typeof s == "function" && s();
    };
    return n.__effect = o, n;
  };
}
function p(t) {
  return function(i) {
    if (t.batchDepth) return i();
    t.batchDepth++;
    try {
      return i();
    } finally {
      if (--t.batchDepth === 0) {
        let e = t.batchedEffects;
        for (t.batchedEffects = null; e; ) {
          const s = e._nextBatchedEffect || null;
          e._nextBatchedEffect = void 0, e._run(), e = s;
        }
      }
    }
  };
}
function g(t) {
  const r = l(), i = { _ctx: r };
  for (const [e, s] of Object.entries(t))
    i[e] = s(r);
  return i;
}
const S = {
  signal: f,
  computed: h,
  effect: d,
  batch: p,
  untrack: v
};
let _ = null;
function u() {
  return _ || (_ = g(S)), _;
}
const T = (t) => u().signal(t), I = (t) => u().computed(t), D = (t) => u().effect(t), E = (t) => u().batch(t), y = (t) => u().untrack(t), N = u()._ctx;
export {
  f as a,
  E as b,
  I as c,
  h as d,
  D as e,
  v as f,
  d as g,
  p as h,
  g as i,
  N as j,
  S as k,
  T as s,
  y as u
};

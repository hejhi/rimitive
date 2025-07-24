function f(t) {
  return t != null && typeof t == "object" && "__type" in t && t.__type === "signal";
}
function e(t) {
  return t != null && typeof t == "object" && "__type" in t && t.__type === "computed";
}
function n(t) {
  return t != null && typeof t == "object" && "__type" in t && t.__type === "effect";
}
function i(t) {
  return t != null && typeof t == "function" && "__effect" in t && n(t.__effect);
}
function o(t) {
  return t.__effect;
}
function c(t) {
  return f(t) || e(t) || n(t);
}
export {
  o as getEffectFromDisposer,
  e as isComputed,
  n as isEffect,
  i as isEffectDisposer,
  c as isReactive,
  f as isSignal
};

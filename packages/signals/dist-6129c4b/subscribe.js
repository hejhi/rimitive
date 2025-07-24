import { e as u } from "./batch-export-Dzw7_XP3.js";
function f(e, i) {
  if ("_subscribe" in e)
    return e._subscribe(i);
  let r = e.value;
  return u(() => {
    const t = e.value;
    Object.is(t, r) || (r = t, i());
  });
}
export {
  f as subscribe
};

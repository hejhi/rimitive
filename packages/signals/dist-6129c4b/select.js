import { subscribe as i } from "./subscribe.js";
function l(e, t) {
  return {
    get value() {
      return t(e.value);
    },
    select(r) {
      return l(e, (u) => r(t(u)));
    },
    _subscribe(r) {
      let u = t(e.value);
      return i(e, () => {
        const n = t(e.peek());
        Object.is(n, u) || (r(), u = n);
      });
    }
  };
}
export {
  l as select
};

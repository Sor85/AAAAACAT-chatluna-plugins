import { openBlock as w, createElementBlock as f, createElementVNode as y, defineComponent as D, Fragment as z, renderList as E, normalizeClass as m, toDisplayString as N, reactive as B, computed as k, onUnmounted as L, ref as x, onMounted as K, normalizeStyle as I, unref as b, createVNode as S, withModifiers as C } from "vue";
const _ = (s, n) => {
  const l = s.__vccOpts || s;
  for (const [r, t] of n)
    l[r] = t;
  return l;
}, X = {}, Y = {
  viewBox: "0 0 1024 1024",
  xmlns: "http://www.w3.org/2000/svg",
  width: "20",
  height: "20"
};
function q(s, n) {
  return w(), f("svg", Y, [...n[0] || (n[0] = [
    y("path", {
      d: "M288 224c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zm320 0c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zM288 512c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zm320 0c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zM352 864c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zm320 0c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z",
      fill: "currentColor"
    }, null, -1)
  ])]);
}
const O = /* @__PURE__ */ _(X, [["render", q]]), V = {}, W = {
  viewBox: "0 0 1024 1024",
  xmlns: "http://www.w3.org/2000/svg",
  width: "20",
  height: "20"
};
function A(s, n) {
  return w(), f("svg", W, [...n[0] || (n[0] = [
    y("path", {
      d: "M831.872 340.864 512 652.672 192.128 340.864a30.592 30.592 0 0 0-42.752 0 29.12 29.12 0 0 0 0 41.6L489.664 714.24a32 32 0 0 0 44.672 0l340.288-331.712a29.12 29.12 0 0 0 0-41.728 30.592 30.592 0 0 0-42.752 0z",
      fill: "currentColor"
    }, null, -1)
  ])]);
}
const P = /* @__PURE__ */ _(V, [["render", A]]), j = ["onClick"], F = /* @__PURE__ */ D({
  __name: "NavSection",
  props: {
    sections: {},
    activeKey: {}
  },
  emits: ["select"],
  setup(s) {
    return (n, l) => (w(!0), f(z, null, E(s.sections, (r) => (w(), f("div", {
      key: r.key,
      class: m([n.$style.item, s.activeKey === r.key ? n.$style.active : ""]),
      onClick: (t) => n.$emit("select", r)
    }, N(r.title), 11, j))), 128));
  }
}), H = "_item_1m2kp_1", U = "_active_1m2kp_16", G = {
  item: H,
  active: U
}, J = {
  $style: G
}, Q = /* @__PURE__ */ _(F, [["__cssModules", J]]);
function R(s) {
  return s instanceof TouchEvent ? {
    x: s.touches[0].clientX,
    y: s.touches[0].clientY
  } : {
    x: s.clientX,
    y: s.clientY
  };
}
function Z(s = {}) {
  const {
    initialTop: n = 100,
    initialRight: l = 20,
    boundarySelector: r = ".plugin-view"
  } = s, t = B({
    isDragging: !1,
    top: n,
    right: l,
    startTop: 0,
    startRight: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0
  }), p = k(() => ({
    top: `${t.top}px`,
    right: `${t.right}px`
  })), i = (d) => {
    var T;
    if (!t.isDragging)
      return;
    const a = R(d), c = t.startTop + (a.y - t.startY), e = t.startRight - (a.x - t.startX), o = (T = document.querySelector(r)) == null ? void 0 : T.getBoundingClientRect();
    let h = 0, v = window.innerHeight - t.height, M = 0, $ = window.innerWidth - t.width;
    o && (h = o.top, v = o.bottom - t.height, M = window.innerWidth - o.right, $ = window.innerWidth - o.left - t.width), t.top = Math.max(h, Math.min(v, c)), t.right = Math.max(M, Math.min($, e));
  }, g = (d, a) => {
    const c = R(d), e = a == null ? void 0 : a.getBoundingClientRect();
    e && (t.width = e.width, t.height = e.height), t.startTop = t.top, t.startRight = t.right, t.startX = c.x, t.startY = c.y, t.isDragging = !0;
  }, u = () => {
    t.isDragging = !1;
  };
  return window.addEventListener("mousemove", i), window.addEventListener("mouseup", u), window.addEventListener("touchmove", i), window.addEventListener("touchend", u), L(() => {
    window.removeEventListener("mousemove", i), window.removeEventListener("mouseup", u), window.removeEventListener("touchmove", i), window.removeEventListener("touchend", u);
  }), {
    position: p,
    startDrag: g
  };
}
function tt(s) {
  const {
    titleToKeyMap: n,
    headerSelector: l = ".k-schema-header",
    rootMargin: r = "-20% 0px -60% 0px",
    threshold: t = 0
  } = s, p = x("");
  let i = null;
  const g = /* @__PURE__ */ new Map(), u = () => {
    i == null || i.disconnect(), g.clear(), i = new IntersectionObserver(
      (c) => {
        for (const e of c) {
          if (!e.isIntersecting)
            continue;
          const o = g.get(e.target);
          o && (p.value = o);
        }
      },
      {
        root: null,
        rootMargin: r,
        threshold: t
      }
    ), document.querySelectorAll(l).forEach((c) => {
      const e = c.textContent || "";
      for (const [o, h] of Object.entries(n))
        if (e.includes(o)) {
          i == null || i.observe(c), g.set(c, h);
          break;
        }
    });
  }, d = () => {
    setTimeout(u, 500);
  };
  return K(d), L(() => {
    i == null || i.disconnect();
  }), {
    activeSection: p,
    refresh: d
  };
}
const et = /* @__PURE__ */ D({
  __name: "SharedNav",
  props: {
    sections: {},
    headerSelector: { default: ".k-schema-header" },
    boundarySelector: { default: ".plugin-view" },
    initialTop: { default: 100 },
    initialRight: { default: 20 },
    rootMargin: { default: "-20% 0px -60% 0px" },
    threshold: { default: 0 }
  },
  setup(s) {
    const n = s, l = x(!1), r = x(null), t = k(
      () => n.sections.reduce(
        (e, o) => (e[o.matchText ?? o.title] = o.key, e),
        {}
      )
    ), p = k(
      () => n.sections.reduce(
        (e, o) => (e[o.key] = o.matchText ?? o.title, e),
        {}
      )
    ), i = (e) => {
      e.stopPropagation(), l.value = !l.value;
    }, { position: g, startDrag: u } = Z({
      initialTop: n.initialTop,
      initialRight: n.initialRight,
      boundarySelector: n.boundarySelector
    }), d = (e) => {
      u(e, r.value);
    }, { activeSection: a } = tt({
      titleToKeyMap: t.value,
      headerSelector: n.headerSelector,
      rootMargin: n.rootMargin,
      threshold: n.threshold
    }), c = (e) => {
      a.value = e.key;
      const o = document.querySelectorAll(n.headerSelector);
      for (let h = 0; h < o.length; h += 1) {
        const v = o[h];
        if ((v.textContent || "").includes(p.value[e.key])) {
          v.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    };
    return (e, o) => (w(), f("div", {
      ref_key: "containerRef",
      ref: r,
      class: m([e.$style.container, l.value ? e.$style.collapsed : ""]),
      style: I(b(g))
    }, [
      y("div", {
        class: m(e.$style.header),
        onMousedown: d,
        onTouchstart: d
      }, [
        S(O, {
          class: m(e.$style.move)
        }, null, 8, ["class"]),
        y("div", {
          class: m(e.$style.toggle),
          onClick: i,
          onMousedown: o[0] || (o[0] = C(() => {
          }, ["stop"])),
          onTouchstart: o[1] || (o[1] = C(() => {
          }, ["stop"]))
        }, [
          S(P)
        ], 34)
      ], 34),
      y("div", {
        class: m(e.$style.body)
      }, [
        S(Q, {
          sections: s.sections,
          "active-key": b(a),
          onSelect: c
        }, null, 8, ["sections", "active-key"])
      ], 2)
    ], 6));
  }
}), ot = "_container_pbgsl_2", nt = "_header_pbgsl_21", st = "_move_pbgsl_36", it = "_toggle_pbgsl_45", rt = "_body_pbgsl_56", ct = "_collapsed_pbgsl_67", lt = {
  container: ot,
  header: nt,
  move: st,
  toggle: it,
  body: rt,
  collapsed: ct
}, at = {
  $style: lt
}, ut = /* @__PURE__ */ _(et, [["__cssModules", at]]);
export {
  ut as SharedNav
};

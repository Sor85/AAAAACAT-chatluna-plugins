import { openBlock as f, createElementBlock as _, createElementVNode as m, defineComponent as b, Fragment as L, renderList as z, normalizeClass as y, toDisplayString as E, reactive as N, computed as M, onUnmounted as D, ref as k, onMounted as B, normalizeStyle as K, createVNode as $, withModifiers as C, unref as I } from "vue";
const S = (n, o) => {
  const a = n.__vccOpts || n;
  for (const [r, t] of o)
    a[r] = t;
  return a;
}, X = {}, Y = {
  viewBox: "0 0 1024 1024",
  xmlns: "http://www.w3.org/2000/svg",
  width: "20",
  height: "20"
};
function j(n, o) {
  return f(), _("svg", Y, [...o[0] || (o[0] = [
    m("path", {
      d: "M288 224c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zm320 0c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zM288 512c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zm320 0c0-35.3 28.7-64 64-64s64 28.7 64 64-28.7 64-64 64-64-28.7-64-64zM352 864c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zm320 0c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64z",
      fill: "currentColor"
    }, null, -1)
  ])]);
}
const q = /* @__PURE__ */ S(X, [["render", j]]), O = {}, V = {
  viewBox: "0 0 1024 1024",
  xmlns: "http://www.w3.org/2000/svg",
  width: "20",
  height: "20"
};
function W(n, o) {
  return f(), _("svg", V, [...o[0] || (o[0] = [
    m("path", {
      d: "M831.872 340.864 512 652.672 192.128 340.864a30.592 30.592 0 0 0-42.752 0 29.12 29.12 0 0 0 0 41.6L489.664 714.24a32 32 0 0 0 44.672 0l340.288-331.712a29.12 29.12 0 0 0 0-41.728 30.592 30.592 0 0 0-42.752 0z",
      fill: "currentColor"
    }, null, -1)
  ])]);
}
const A = /* @__PURE__ */ S(O, [["render", W]]), P = ["onClick"], F = /* @__PURE__ */ b({
  __name: "NavSection",
  props: {
    sections: {},
    activeKey: {}
  },
  emits: ["select"],
  setup(n) {
    return (o, a) => (f(!0), _(L, null, z(n.sections, (r) => (f(), _("div", {
      key: r.key,
      class: y([o.$style.item, n.activeKey === r.key ? o.$style.active : ""]),
      onClick: (t) => o.$emit("select", r)
    }, E(r.title), 11, P))), 128));
  }
}), H = "_item_1jnrt_1", U = "_active_1jnrt_16", G = {
  item: H,
  active: U
}, J = {
  $style: G
}, Q = /* @__PURE__ */ S(F, [["__cssModules", J]]);
function R(n) {
  return n instanceof TouchEvent ? {
    x: n.touches[0].clientX,
    y: n.touches[0].clientY
  } : {
    x: n.clientX,
    y: n.clientY
  };
}
function Z(n = {}) {
  const {
    initialTop: o = 100,
    initialRight: a = 20,
    boundarySelector: r = ".plugin-view"
  } = n, t = N({
    isDragging: !1,
    top: o,
    right: a,
    startTop: 0,
    startRight: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0
  }), p = M(() => ({
    top: `${t.top}px`,
    right: `${t.right}px`
  })), i = (h) => {
    var T;
    if (!t.isDragging)
      return;
    const d = R(h), c = t.startTop + (d.y - t.startY), l = t.startRight - (d.x - t.startX), e = (T = document.querySelector(r)) == null ? void 0 : T.getBoundingClientRect();
    let s = 0, w = window.innerHeight - t.height, v = 0, x = window.innerWidth - t.width;
    e && (s = e.top, w = e.bottom - t.height, v = window.innerWidth - e.right, x = window.innerWidth - e.left - t.width), t.top = Math.max(s, Math.min(w, c)), t.right = Math.max(v, Math.min(x, l));
  }, g = (h, d) => {
    const c = R(h), l = d == null ? void 0 : d.getBoundingClientRect();
    l && (t.width = l.width, t.height = l.height), t.startTop = t.top, t.startRight = t.right, t.startX = c.x, t.startY = c.y, t.isDragging = !0;
  }, u = () => {
    t.isDragging = !1;
  };
  return window.addEventListener("mousemove", i), window.addEventListener("mouseup", u), window.addEventListener("touchmove", i), window.addEventListener("touchend", u), D(() => {
    window.removeEventListener("mousemove", i), window.removeEventListener("mouseup", u), window.removeEventListener("touchmove", i), window.removeEventListener("touchend", u);
  }), {
    position: p,
    startDrag: g
  };
}
function tt(n) {
  const {
    titleToKeyMap: o,
    headerSelector: a = ".k-schema-header",
    rootMargin: r = "-20% 0px -60% 0px",
    threshold: t = 0
  } = n, p = k("");
  let i = null;
  const g = /* @__PURE__ */ new Map(), u = () => {
    i == null || i.disconnect(), g.clear(), i = new IntersectionObserver(
      (c) => {
        for (const l of c) {
          if (!l.isIntersecting)
            continue;
          const e = g.get(l.target);
          e && (p.value = e);
        }
      },
      {
        root: null,
        rootMargin: r,
        threshold: t
      }
    ), document.querySelectorAll(a).forEach((c) => {
      const l = c.textContent || "";
      for (const [e, s] of Object.entries(o))
        if (l.includes(e)) {
          i == null || i.observe(c), g.set(c, s);
          break;
        }
    });
  }, h = () => {
    setTimeout(u, 500);
  };
  return B(h), D(() => {
    i == null || i.disconnect();
  }), {
    activeSection: p,
    refresh: h
  };
}
const et = /* @__PURE__ */ b({
  __name: "SharedNav",
  props: {
    sections: {},
    headerSelector: { default: ".k-schema-header" },
    boundarySelector: { default: ".plugin-view" },
    initialTop: { default: 100 },
    initialRight: { default: 20 },
    width: {},
    rootMargin: { default: "-20% 0px -60% 0px" },
    threshold: { default: 0 }
  },
  setup(n) {
    const o = n, a = k(!1), r = k(null), t = M(
      () => o.sections.reduce(
        (e, s) => (e[s.matchText ?? s.title] = s.key, e),
        {}
      )
    ), p = M(
      () => o.sections.reduce(
        (e, s) => (e[s.key] = s.matchText ?? s.title, e),
        {}
      )
    ), i = (e) => {
      e.stopPropagation(), a.value = !a.value;
    }, { position: g, startDrag: u } = Z({
      initialTop: o.initialTop,
      initialRight: o.initialRight,
      boundarySelector: o.boundarySelector
    }), h = M(() => ({
      ...g.value,
      ...o.width ? { width: `${o.width}px` } : {}
    })), d = (e) => {
      u(e, r.value);
    }, { activeSection: c } = tt({
      titleToKeyMap: t.value,
      headerSelector: o.headerSelector,
      rootMargin: o.rootMargin,
      threshold: o.threshold
    }), l = (e) => {
      c.value = e.key;
      const s = document.querySelectorAll(o.headerSelector);
      for (let w = 0; w < s.length; w += 1) {
        const v = s[w];
        if ((v.textContent || "").includes(p.value[e.key])) {
          v.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    };
    return (e, s) => (f(), _("div", {
      ref_key: "containerRef",
      ref: r,
      class: y([e.$style.container, a.value ? e.$style.collapsed : ""]),
      style: K(h.value)
    }, [
      m("div", {
        class: y(e.$style.header),
        onMousedown: d,
        onTouchstart: d
      }, [
        $(q, {
          class: y(e.$style.move)
        }, null, 8, ["class"]),
        m("div", {
          class: y(e.$style.toggle),
          onClick: i,
          onMousedown: s[0] || (s[0] = C(() => {
          }, ["stop"])),
          onTouchstart: s[1] || (s[1] = C(() => {
          }, ["stop"]))
        }, [
          $(A)
        ], 34)
      ], 34),
      m("div", {
        class: y(e.$style.body)
      }, [
        $(Q, {
          sections: n.sections,
          "active-key": I(c),
          onSelect: l
        }, null, 8, ["sections", "active-key"])
      ], 2)
    ], 6));
  }
}), ot = "_container_wya55_2", nt = "_header_wya55_31", st = "_move_wya55_46", it = "_toggle_wya55_55", rt = "_body_wya55_66", ct = "_collapsed_wya55_77", lt = {
  container: ot,
  header: nt,
  move: st,
  toggle: it,
  body: rt,
  collapsed: ct
}, at = {
  $style: lt
}, ut = /* @__PURE__ */ S(et, [["__cssModules", at]]);
export {
  ut as SharedNav
};

(() => {
  "use strict";

  const start = () => {
    window.marketplaceMotion?.destroy?.();

    const hero = document.querySelector("#hero");
    const visual = document.querySelector("[data-hero-visual]");
    const image = visual?.querySelector("img");
    const titleLines = [...document.querySelectorAll("[data-hero-title] [data-title-line]")];
    const copy = document.querySelector("[data-hero-copy]");
    const grid = document.querySelector("#role-grid");
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const gsap = window.gsap;
    const scrollPlugin = window.ScrollTrigger;
    const listeners = [];
    let controller = null;
    let matchMedia = null;
    let introPlayed = false;
    let destroyed = false;

    const listen = (target, name, callback, options) => {
      target?.addEventListener(name, callback, options);
      listeners.push(() => target?.removeEventListener(name, callback, options));
    };

    const createController = ({ reduce, fine }) => {
      const snapshots = new Map();
      const records = new Set();
      const triggers = new Set();
      const pending = new Set();
      const revealed = new WeakSet();
      const localListeners = [];
      const animationFrames = new Set();
      let active = !document.hidden && document.hasFocus();
      let disposed = false;
      let catalogFrame = 0;
      let scrollFrame = 0;
      let pointerFrame = 0;
      let observer = null;

      const addListener = (target, name, callback, options) => {
        target?.addEventListener(name, callback, options);
        localListeners.push(() => target?.removeEventListener(name, callback, options));
      };
      const frame = (callback) => {
        const id = requestAnimationFrame(() => {
          animationFrames.delete(id);
          if (!disposed) callback();
        });
        animationFrames.add(id);
        return id;
      };
      const remember = (node, properties) => {
        if (!snapshots.has(node)) snapshots.set(node, new Map());
        const saved = snapshots.get(node);
        properties.forEach((property) => {
          if (!saved.has(property)) saved.set(property, [node.style.getPropertyValue(property), node.style.getPropertyPriority(property)]);
        });
      };
      const restore = (node, properties) => {
        const saved = snapshots.get(node);
        if (!saved) return;
        (properties || [...saved.keys()]).forEach((property) => {
          if (!saved.has(property)) return;
          const [value, priority] = saved.get(property);
          if (value) node.style.setProperty(property, value, priority);
          else node.style.removeProperty(property);
        });
      };
      const visible = (node) => {
        if (!node.isConnected || node.hidden || node.getAttribute("aria-hidden") === "true") return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
      };
      const inView = (node) => {
        if (!visible(node)) return false;
        const rect = node.getBoundingClientRect();
        return rect.top < innerHeight * 0.96 && rect.bottom > 0;
      };

      // Original markup stays visible. Start styles only exist while an animation runs.
      const animate = (nodes, from, to, { duration = 0.5, stagger = 0, kind = "reveal", position = 0 } = {}) => {
        nodes = nodes.filter((node) => node && visible(node));
        if (!nodes.length || reduce || !active || disposed) return null;
        const properties = ["transform", "opacity", ...(Object.hasOwn(from, "filter") ? ["filter"] : [])];
        nodes.forEach((node) => remember(node, properties));
        const record = { nodes, kind, players: [], resume: [], stopped: false };
        const finish = () => {
          if (record.stopped) return;
          record.stopped = true;
          record.players.forEach((player) => {
            if (gsap) player.kill();
            else player.cancel();
          });
          // The visual's y belongs to ScrollTrigger. Keep its settled x until teardown.
          const settledProperties = kind === "hero-intro" && gsap ? ["opacity"] : properties;
          nodes.forEach((node) => restore(node, settledProperties));
          records.delete(record);
        };
        record.stop = finish;
        records.add(record);
        try {
          if (gsap) {
            const timeline = gsap.timeline({ onComplete: finish, defaults: { ease: "power3.out" } });
            record.players.push(timeline);
            timeline.fromTo(nodes, from, { ...to, duration, stagger, overwrite: "auto" }, position);
          } else if (typeof Element.prototype.animate === "function") {
            let completed = 0;
            const translate = (vars) => `translate3d(${vars.x || 0}px, ${vars.y || 0}px, 0)`;
            const keyframe = (vars) => ({
              transform: translate(vars),
              ...(vars.opacity === undefined ? {} : { opacity: vars.opacity }),
              ...(vars.filter === undefined ? {} : { filter: vars.filter })
            });
            nodes.forEach((node, index) => {
              const player = node.animate([keyframe(from), keyframe(to)], {
                duration: duration * 1000,
                delay: (position + index * stagger) * 1000,
                easing: "cubic-bezier(.16, 1, .3, 1)",
                fill: "both"
              });
              record.players.push(player);
              player.onfinish = () => { if (++completed === nodes.length) finish(); };
            });
          } else finish();
        } catch (error) {
          finish();
          console.warn("Marketplace motion: static content retained.", error);
        }
        return record;
      };

      const reveal = (nodes, catalog = false) => {
        const candidates = nodes.filter((node) => visible(node) && (catalog || !revealed.has(node)));
        candidates.forEach((node) => {
          revealed.add(node);
          pending.delete(node);
          observer?.unobserve(node);
        });
        if (!candidates.length) return;
        animate(candidates, { opacity: catalog ? 0.62 : 0.45, y: catalog ? 8 : 16 }, { opacity: 1, y: 0 }, {
          duration: catalog ? 0.32 : 0.5,
          stagger: catalog ? 0.025 : 0.045,
          kind: candidates.some((node) => node.matches(".role-card")) ? "cards" : "reveal"
        });
      };
      const revealVisible = () => {
        if (!active || reduce) return;
        reveal([...pending].filter(inView));
      };
      if (!reduce && "IntersectionObserver" in window) {
        observer = new IntersectionObserver((entries) => {
          if (!active) return;
          reveal(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target));
        }, { rootMargin: "0px 0px -4% 0px", threshold: 0.02 });
      }
      const observe = (nodes) => {
        if (reduce) return;
        nodes.forEach((node) => {
          if (revealed.has(node) || !visible(node)) return;
          pending.add(node);
          observer?.observe(node);
        });
        revealVisible();
      };

      if (!introPlayed) {
        introPlayed = true;
        animate(titleLines, { opacity: 0.12, y: 18, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)" }, {
          duration: 0.8, stagger: 0.1, kind: "intro"
        });
        animate(copy ? [copy] : [], { opacity: 0.55, y: 10 }, { opacity: 1, y: 0 }, {
          duration: 0.65, position: 0.12, kind: "intro"
        });
        // Move entrance horizontally; scrolling owns y, so the two never compete.
        animate(visual ? [visual] : [], { opacity: 0.45, x: 14 }, { opacity: 1, x: 0 }, {
          duration: 0.95, position: 0.06, kind: "hero-intro"
        });
      }

      const sectionTargets = [...document.querySelectorAll("[data-reveal]")].filter((node) => {
        return !node.closest("#hero") && !node.matches(".role-card") && node !== grid && !node.contains(grid) && !node.closest("#role-grid");
      });
      observe(sectionTargets);
      observe(grid ? [...grid.querySelectorAll(".role-card")] : []);

      let scrollTween = null;
      if (!reduce && fine && hero && visual) {
        remember(visual, ["transform"]);
        if (gsap && scrollPlugin) {
          gsap.registerPlugin(scrollPlugin);
          scrollTween = gsap.to(visual, {
            y: -24,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.45 }
          });
          triggers.add(scrollTween.scrollTrigger);
        } else if (window.CSS?.supports("translate", "0px 0px")) {
          remember(visual, ["translate"]);
          const updateScroll = () => {
            scrollFrame = 0;
            if (!active) return;
            const rect = hero.getBoundingClientRect();
            const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
            visual.style.translate = `0px ${-24 * progress}px`;
          };
          const queueScroll = () => { if (!scrollFrame && active) scrollFrame = frame(updateScroll); };
          addListener(window, "scroll", queueScroll, { passive: true });
          addListener(window, "resize", queueScroll, { passive: true });
          queueScroll();
        }
      }

      let resetPointer = () => {};
      if (!reduce && fine && visual && image) {
        remember(image, ["transform"]);
        let moveX;
        let moveY;
        if (gsap) {
          const xTo = gsap.quickTo(image, "x", { duration: 0.5, ease: "power3.out" });
          const yTo = gsap.quickTo(image, "y", { duration: 0.5, ease: "power3.out" });
          moveX = xTo;
          moveY = yTo;
          const record = { kind: "pointer", nodes: [image], players: [xTo.tween, yTo.tween], resume: [] };
          record.stop = () => { record.players.forEach((player) => player.kill()); restore(image, ["transform"]); records.delete(record); };
          records.add(record);
        } else {
          const originalTransform = getComputedStyle(image).transform;
          const base = originalTransform === "none" ? "" : originalTransform;
          const current = { x: 0, y: 0 };
          const target = { x: 0, y: 0 };
          const tick = () => {
            pointerFrame = 0;
            if (!active) return;
            current.x += (target.x - current.x) * 0.13;
            current.y += (target.y - current.y) * 0.13;
            image.style.transform = `${base} translate3d(${current.x.toFixed(3)}px, ${current.y.toFixed(3)}px, 0)`;
            if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.02) pointerFrame = frame(tick);
          };
          const queue = () => { if (!pointerFrame && active) pointerFrame = frame(tick); };
          moveX = (value) => { target.x = value; queue(); };
          moveY = (value) => { target.y = value; queue(); };
        }
        const reset = () => { moveX(0); moveY(0); };
        resetPointer = reset;
        addListener(visual, "pointermove", (event) => {
          if (!active || event.pointerType === "touch") return;
          const rect = visual.getBoundingClientRect();
          const clamp = (value) => Math.max(-6, Math.min(6, value));
          moveX(clamp(((event.clientX - rect.left) / rect.width - 0.5) * 12));
          moveY(clamp(((event.clientY - rect.top) / rect.height - 0.5) * 12));
        }, { passive: true });
        addListener(visual, "pointerleave", reset, { passive: true });
      }

      const refresh = () => {
        catalogFrame = 0;
        [...records].filter((record) => record.kind === "cards").forEach((record) => record.stop());
        [...pending].filter((node) => !node.isConnected || !visible(node)).forEach((node) => {
          observer?.unobserve(node);
          pending.delete(node);
        });
        const cards = grid ? [...grid.querySelectorAll(".role-card")].filter(visible) : [];
        reveal(cards.filter(inView), true);
        observe(cards.filter((node) => !inView(node)));
        // Refresh only after a real content change, never on each scroll event.
        if (active) scrollPlugin?.refresh?.();
      };
      const queueCatalogRefresh = () => {
        if (catalogFrame) cancelAnimationFrame(catalogFrame);
        catalogFrame = frame(refresh);
      };
      addListener(document, "catalog:updated", queueCatalogRefresh);
      addListener(window, "catalog:updated", queueCatalogRefresh);

      const setActive = (override) => {
        const next = typeof override === "boolean" ? override : !document.hidden && document.hasFocus();
        if (active === next) return;
        active = next;
        records.forEach((record) => {
          if (!active) {
            record.resume = record.players.filter((player) => gsap ? player.isActive() : player.playState === "running");
            record.resume.forEach((player) => player.pause());
          } else {
            record.resume.forEach((player) => gsap ? player.resume() : player.play());
            record.resume = [];
          }
        });
        triggers.forEach((trigger) => active ? trigger.enable(false, false) : trigger.disable(false, false));
        if (!active) scrollTween?.pause();
        if (active) {
          resetPointer();
          revealVisible();
          scrollPlugin?.update?.();
          window.dispatchEvent(new Event("scroll"));
        }
      };
      addListener(document, "visibilitychange", setActive);
      addListener(window, "blur", setActive);
      addListener(window, "focus", setActive);
      if (!active) triggers.forEach((trigger) => trigger.disable(false, false));

      if (!observer && !reduce) addListener(window, "scroll", revealVisible, { passive: true });

      return {
        refresh,
        setActive,
        destroy() {
          disposed = true;
          observer?.disconnect();
          localListeners.forEach((remove) => remove());
          animationFrames.forEach((id) => cancelAnimationFrame(id));
          records.forEach((record) => record.stop());
          triggers.forEach((trigger) => trigger.kill());
          scrollTween?.kill();
          snapshots.forEach((_, node) => restore(node));
          pending.clear();
        }
      };
    };

    const rebuild = (conditions) => {
      controller?.destroy();
      controller = createController(conditions || { reduce: reduceQuery.matches, fine: fineQuery.matches });
    };
    try {
      if (gsap?.matchMedia) {
        matchMedia = gsap.matchMedia();
        matchMedia.add({ all: "(min-width: 0px)", reduce: reduceQuery.media, fine: fineQuery.media }, (context) => {
          rebuild(context.conditions);
          return () => { controller?.destroy(); controller = null; };
        });
      } else {
        rebuild();
        listen(reduceQuery, "change", () => rebuild());
        listen(fineQuery, "change", () => rebuild());
      }
    } catch (error) {
      controller?.destroy();
      controller = null;
      console.warn("Marketplace motion: animations disabled; content remains available.", error);
    }

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      matchMedia?.revert();
      controller?.destroy();
      listeners.forEach((remove) => remove());
      if (window.marketplaceMotion?.destroy === destroy) delete window.marketplaceMotion;
    };
    listen(window, "pagehide", (event) => {
      if (event.persisted) controller?.setActive(false);
      else destroy();
    });
    listen(window, "pageshow", () => controller?.setActive());
    window.marketplaceMotion = { refresh: () => controller?.refresh(), destroy };
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

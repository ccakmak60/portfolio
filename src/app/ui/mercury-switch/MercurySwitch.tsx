"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { clamp, createSim, PX, PY, REST, step, type Sim } from "./mercury";
import { createSwitchRenderer, FRAME } from "./renderSwitch";
import styles from "./mercury-switch.module.css";

const STEP = 1 / 120;
const SLIDE = 110;
const DRAG_LIMIT = REST + 0.35;
const wrap = (angle: number) => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));

type Gesture = {
  id: number;
  scale: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  base: number;
  angle: number;
  heading: number;
  turning: boolean;
  nearPivot: boolean;
  moved: boolean;
};

type Animation = { sim: Sim; wake: () => void };

export default function MercurySwitch() {
  const [checked, setChecked] = useState(false);
  const [rendered, setRendered] = useState(false);
  const current = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation>(null);
  const gesture = useRef<Gesture>(null);
  const suppressClick = useRef(false);

  function show(on: boolean) {
    current.current = on;
    setChecked(on);
  }

  useEffect(() => {
    const artwork = canvas.current;
    const face = panel.current;
    const outline = ring.current;
    const label = word.current;
    if (!artwork || !face || !outline || !label) return;

    const scene = artwork;
    const focusRing = outline;
    const stateLabel = label;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const font = getComputedStyle(face).getPropertyValue("--font-mercury-dial").trim();
    let mounted = true;
    let renderer: ReturnType<typeof createSwitchRenderer> = null;
    let raf: number | undefined;

    function stop() {
      if (raf !== undefined) cancelAnimationFrame(raf);
      raf = undefined;
      animation.current = null;
      renderer?.dispose();
      renderer = null;
      focusRing.style.rotate = "";
      stateLabel.style.transform = "";
    }

    async function start() {
      if (motion.matches) return;
      await document.fonts.load(`500 13px ${font}`).catch(() => []);
      if (!mounted || motion.matches || renderer) return;

      const view = createSwitchRenderer(scene, font);
      if (!view) return;
      renderer = view;

      const sim = createSim(current.current);
      let heat = Number(current.current);
      let pop = 0;
      let velocity = 0;
      let last = 0;
      let elapsed = 0;

      const paint = () => {
        view.paint(sim, heat);
        focusRing.style.rotate = `${sim.th}rad`;
        stateLabel.style.transform = `scale(${1 + pop})`;
      };

      const tick = (now: number) => {
        raf = undefined;
        elapsed += Math.min((now - last) / 1000, 1 / 30);
        last = now;

        while (elapsed >= STEP) {
          if (sim.still <= 0.5 || sim.mode !== "free") {
            for (let i = 0; i < 4; i++) step(sim, STEP / 4);
          }
          if (sim.closed !== current.current) {
            current.current = sim.closed;
            setChecked(sim.closed);
            velocity += sim.closed ? 5.2 : -3.4;
          }
          const target = Number(sim.closed);
          heat += (target - heat) * Math.min(1, STEP / (sim.closed ? 0.05 : 0.34));
          if (Math.abs(target - heat) < 0.004) heat = target;
          velocity += (-1000 * pop - 15 * velocity) * STEP;
          pop += velocity * STEP;
          elapsed -= STEP;
        }

        const moving = sim.still <= 0.5 || heat !== Number(sim.closed)
          || Math.abs(velocity) > 0.03 || Math.abs(pop) > 0.0015;
        if (!moving) pop = velocity = 0;
        paint();
        if (moving) raf = requestAnimationFrame(tick);
      };

      animation.current = {
        sim,
        wake() {
          if (raf !== undefined) return;
          last = performance.now();
          elapsed = 0;
          raf = requestAnimationFrame(tick);
        },
      };
      paint();
      setRendered(true);
    }

    function contextLost(event: Event) {
      event.preventDefault();
      stop();
      setRendered(false);
    }

    function motionChanged() {
      stop();
      setRendered(false);
      void start();
    }

    scene.addEventListener("webglcontextlost", contextLost);
    scene.addEventListener("webglcontextrestored", start);
    motion.addEventListener("change", motionChanged);
    void start();

    return () => {
      mounted = false;
      scene.removeEventListener("webglcontextlost", contextLost);
      scene.removeEventListener("webglcontextrestored", start);
      motion.removeEventListener("change", motionChanged);
      stop();
    };
  }, []);

  function toggle() {
    const live = animation.current;
    if (!live) {
      show(!current.current);
      return;
    }

    const { sim, wake } = live;
    const heading = sim.mode === "key" ? Math.sign(sim.want) : (sim.th > 0 ? 1 : -1);
    sim.mode = "key";
    sim.want = -heading * REST * 1.4;
    sim.still = 0;
    wake();
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || !panel.current) return;
    suppressClick.current = false;

    const rect = panel.current.getBoundingClientRect();
    const scale = FRAME / rect.width;
    const x = (event.clientX - rect.left) * scale - PX;
    const y = (event.clientY - rect.top) * scale - PY;
    if (y + PY > 348) return;

    const base = animation.current?.sim.th ?? (current.current ? REST : -REST);
    gesture.current = {
      id: event.pointerId,
      scale,
      x,
      y,
      startX: event.clientX,
      startY: event.clientY,
      base,
      angle: base,
      heading: Math.atan2(y, x),
      turning: Math.hypot(x, y) > 40,
      nearPivot: false,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || event.pointerId !== active.id) return;

    const dx = (event.clientX - active.startX) * active.scale;
    const dy = (event.clientY - active.startY) * active.scale;
    if (!active.moved && Math.hypot(dx, dy) <= 4) return;
    active.moved = true;

    const x = active.x + dx;
    const y = active.y + dy;
    if (!active.turning) {
      active.angle = active.base + dx / SLIDE;
    } else {
      const nearPivot = Math.hypot(x, y) < 14;
      if (!nearPivot) {
        const heading = Math.atan2(y, x);
        if (!active.nearPivot) active.angle += wrap(heading - active.heading);
        active.heading = heading;
      }
      active.nearPivot = nearPivot;
    }
    active.angle = clamp(active.angle, -DRAG_LIMIT, DRAG_LIMIT);

    const live = animation.current;
    if (!live) return;
    live.sim.mode = "held";
    live.sim.want = active.angle;
    live.sim.still = 0;
    live.wake();
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, settle: boolean) {
    const active = gesture.current;
    if (!active || event.pointerId !== active.id) return;
    gesture.current = null;
    if (!active.moved) return;

    suppressClick.current = settle;
    const live = animation.current;
    if (!live) {
      if (settle) show(active.angle > 0);
      return;
    }
    live.sim.mode = "key";
    live.sim.want = (settle ? active.angle > 0 : current.current) ? REST * 1.4 : -REST * 1.4;
    live.sim.still = 0;
    live.wake();
  }

  return (
    <div className={styles.panel} ref={panel} data-on={checked} data-rendered={rendered}>
      <div className={styles.still} aria-hidden="true" />
      <canvas className={styles.canvas} ref={canvas} aria-hidden="true" />
      <button
        type="button"
        className={styles.switch}
        role="switch"
        aria-label="Heating"
        aria-checked={checked}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={(event) => finishDrag(event, false)}
        onLostPointerCapture={(event) => finishDrag(event, false)}
        onClick={(event) => {
          if (event.detail === 0 || !suppressClick.current) toggle();
          suppressClick.current = false;
        }}
      >
        <span className={styles.dragArea} aria-hidden="true" />
        <span className={styles.ring} ref={ring} aria-hidden="true" />
        <span className={styles.row} aria-hidden="true">
          <span>Heating</span>
          <span className={styles.state} ref={word}>{checked ? "On" : "Off"}</span>
        </span>
      </button>
    </div>
  );
}

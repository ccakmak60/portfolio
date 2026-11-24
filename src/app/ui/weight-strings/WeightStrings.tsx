"use client";

import localFont from "next/font/local";
import { useEffect, useId, useRef, useState } from "react";
import {
  aim,
  BOARD_SIZE,
  choose,
  create,
  INITIAL_STRING,
  lift,
  PITCH,
  SPAN,
  step,
  strings,
  TIME_STEP,
  TOP,
  touch,
  trace,
  X0,
  X1,
} from "./strings";
import styles from "./weight-strings.module.css";

const archivo = localFont({
  src: "./archivo-latin.woff2",
  weight: "100 900",
});

const rowTop = TOP - PITCH / 2;
const lastStringY = TOP + PITCH * (strings.length - 1);
const percent = (coordinate: number) => `${(coordinate / BOARD_SIZE) * 100}%`;
const tapDistance = 4;

export default function WeightStrings() {
  const [selected, setSelected] = useState(INITIAL_STRING);
  const board = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const wires = useRef<SVGSVGElement>(null);
  const play = useRef<(index: number) => void>(undefined);
  const id = useId();

  useEffect(() => {
    const boardElement = board.current;
    const title = legend.current;
    const hitArea = surface.current;
    const paths = wires.current?.querySelectorAll("path");
    if (!boardElement || !title || !hitArea || !paths) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let selection = INITIAL_STRING;
    let simulation = create(selection);
    let pointer: { id: number; x: number; y: number; dragging: boolean } | null = null;
    let frame = 0;
    let lastTime = 0;
    let remainder = 0;

    const draw = () => {
      if (selection !== simulation.pick) {
        selection = simulation.pick;
        setSelected(selection);
      }
      title.style.fontWeight = simulation.wght.toFixed(1);
      simulation.wires.forEach((wire, index) => {
        const path = paths[index];
        const shape = trace(wire);
        if (path.getAttribute("d") !== shape) path.setAttribute("d", shape);
      });
    };

    const advance = (now: number) => {
      remainder += Math.min(Math.max(0, now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      while (remainder >= TIME_STEP) {
        step(simulation);
        remainder -= TIME_STEP;
      }
    };

    const animate = (now: number) => {
      advance(now);
      draw();
      frame = simulation.asleep ? 0 : requestAnimationFrame(animate);
    };

    const wake = () => {
      if (frame) return;
      lastTime = performance.now();
      remainder = 0;
      frame = requestAnimationFrame(animate);
    };

    const select = (index: number, at?: number) => {
      if (motion.matches) {
        simulation.pick = index;
        simulation.wght = strings[index].weight;
      } else {
        if (frame) advance(performance.now());
        choose(simulation, index, at);
        wake();
      }
      draw();
    };

    const position = (event: PointerEvent) => {
      const bounds = boardElement.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) * BOARD_SIZE) / bounds.width,
        y: ((event.clientY - bounds.top) * BOARD_SIZE) / bounds.height,
      };
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, ...position(event), dragging: false };
      hitArea.setPointerCapture(event.pointerId);
    };

    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { x, y } = position(event);
      if (!pointer.dragging) {
        if (Math.hypot(x - pointer.x, y - pointer.y) <= tapDistance) return;
        pointer.dragging = true;
        if (!motion.matches) touch(simulation, pointer.x, pointer.y);
      }
      if (motion.matches) return;
      if (frame) advance(performance.now());
      aim(simulation, x, y);
      wake();
    };

    const cancel = () => {
      if (!pointer) return;
      const { id: pointerId, dragging } = pointer;
      pointer = null;
      if (hitArea.hasPointerCapture(pointerId)) hitArea.releasePointerCapture(pointerId);
      if (dragging && !motion.matches) {
        const picked = simulation.pick;
        lift(simulation);
        simulation.pick = picked;
        wake();
      }
    };

    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      move(event);
      const { dragging } = pointer;
      pointer = null;

      if (dragging) {
        if (!motion.matches) {
          lift(simulation);
          wake();
          draw();
        }
        return;
      }

      const { x, y } = position(event);
      const index = Math.round((y - TOP) / PITCH);
      if (strings[index] && x >= X0 && x <= X1) select(index, (x - X0) / SPAN);
    };

    const cancelPointer = (event: PointerEvent) => {
      if (pointer?.id === event.pointerId) cancel();
    };

    const resetMotion = () => {
      cancel();
      cancelAnimationFrame(frame);
      frame = 0;
      simulation = create(selection);
      draw();
    };

    play.current = select;
    hitArea.addEventListener("pointerdown", down);
    hitArea.addEventListener("pointermove", move);
    hitArea.addEventListener("pointerup", up);
    hitArea.addEventListener("pointercancel", cancelPointer);
    hitArea.addEventListener("lostpointercapture", cancelPointer);
    window.addEventListener("blur", cancel);
    motion.addEventListener("change", resetMotion);

    return () => {
      cancelAnimationFrame(frame);
      play.current = undefined;
      hitArea.removeEventListener("pointerdown", down);
      hitArea.removeEventListener("pointermove", move);
      hitArea.removeEventListener("pointerup", up);
      hitArea.removeEventListener("pointercancel", cancelPointer);
      hitArea.removeEventListener("lostpointercapture", cancelPointer);
      window.removeEventListener("blur", cancel);
      motion.removeEventListener("change", resetMotion);
    };
  }, []);

  return (
    <div className={`${styles.board} ${archivo.className}`} ref={board}>
      <div className={styles.legend} id={id} ref={legend}>Weight</div>
      <div className={styles.group} role="radiogroup" aria-labelledby={id}>
        {strings.map(({ name, weight }, index) => (
          <label className={styles.row} key={name} style={{ top: percent(rowTop + PITCH * index) }}>
            <span className={styles.name} style={{ fontWeight: weight }}>{name}</span>
            <input
              className={styles.pin}
              type="radio"
              name={id}
              value={weight}
              checked={index === selected}
              onChange={() => play.current?.(index)}
              onClick={() => {
                if (index === selected) play.current?.(index);
              }}
            />
          </label>
        ))}
      </div>
      <svg className={styles.strings} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`} aria-hidden="true" ref={wires}>
        <line x1={X1} x2={X1} y1={TOP - 15} y2={lastStringY + 15} strokeWidth={1.5} />
        {strings.map(({ name, gauge }, index) => (
          <path key={name} strokeWidth={gauge} d={`M${X0} ${TOP + PITCH * index}H${X1}`} />
        ))}
      </svg>
      <div
        className={styles.surface}
        aria-hidden="true"
        ref={surface}
        style={{ left: percent(X0), top: percent(rowTop), width: percent(SPAN), height: percent(PITCH * strings.length) }}
      />
    </div>
  );
}

"use client";

import localFont from "next/font/local";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import styles from "./turntable.module.css";

const jost = localFont({
  src: "./jost-latin.woff2",
  weight: "100 900",
});

const originalSpeed = { value: "45", rpm: 45, name: "45 rpm" };
const speeds = [
  { value: "33", rpm: 100 / 3, name: "33⅓ rpm" },
  originalSpeed,
  { value: "78", rpm: 78, name: "78 rpm" },
];

const dialAngles = Array.from({ length: 13 }, (_, index) => {
  const hour = index - 6;
  const radians = Math.PI / 180;
  return Math.atan(Math.sin(52 * radians) * Math.tan(hour * 15 * radians)) / radians;
});

export default function Turntable() {
  const groupName = useId();
  const label = useRef<SVGSVGElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const targetRate = useRef(originalSpeed.rpm * 6);

  useEffect(() => {
    const artwork = label.current;
    const reflection = sheen.current;
    if (!artwork || !reflection) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let before = 0;
    let turn = 0;
    let rate = 0;

    const step = (now: number) => {
      const elapsed = Math.min(0.05, (now - before) / 1000);
      before = now;
      rate += (targetRate.current - rate) * (1 - Math.exp(-elapsed / 0.42));
      turn = (turn + rate * elapsed) % 360;
      const rock = Math.sin((turn * Math.PI) / 180) * Math.min(1, rate / 200) * 0.8;

      artwork.style.rotate = `${turn}deg`;
      reflection.style.rotate = `${rock}deg`;
      frame = requestAnimationFrame(step);
    };

    const syncMotion = () => {
      cancelAnimationFrame(frame);
      if (motion.matches) {
        artwork.style.removeProperty("rotate");
        reflection.style.removeProperty("rotate");
        turn = 0;
        rate = 0;
        return;
      }
      before = performance.now();
      frame = requestAnimationFrame(step);
    };

    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <div className={`${styles.turntable} ${jost.className}`}>
      <Image
        src="/ui/turntable-deck.webp"
        alt="Yellow turntable with Apricot Hour by Odalys Brandt on the platter"
        fill
        loading="eager"
        sizes="(max-width: 588px) calc(100vw - 48px), 540px"
      />
      <div className={styles.sheen} ref={sheen} aria-hidden="true" />

      <div className={styles.label} aria-hidden="true">
        <svg ref={label} viewBox="-100 -100 200 200">
          <circle r="103" fill="#e8302c" />
          <circle r="15.5" fill="#fff" />
          <g fill="none" stroke="#fff" strokeWidth="1.5">
            {dialAngles.map((angle, index) => (
              <line
                key={angle}
                x1="0"
                y1="-24"
                x2="0"
                y2={index % 3 === 0 ? -90 : -84}
                transform={`rotate(${angle})`}
              />
            ))}
            <path d="M -90 0 A 90 90 0 0 1 90 0" />
          </g>
          <g textAnchor="middle">
            <text className={styles.labelSmall} x="-55" y="14">45 RPM</text>
            <text className={styles.labelSmall} x="55" y="14">SIDE A</text>
            <text className={styles.labelMark} y="43">GNOMON</text>
            <text className={styles.labelTitle} y="61">Apricot Hour</text>
            <text className={styles.labelSmall} y="72.5">ODALYS BRANDT</text>
            <text className={styles.labelRim} y="84.5">GN 45-017</text>
          </g>
        </svg>
      </div>

      <div className={styles.panel}>
        <span className={styles.rpm} aria-hidden="true">RPM</span>
        <fieldset className={styles.speeds} aria-label="Turntable speed">
          {speeds.map((speed) => (
            <label className={styles.speed} key={speed.value}>
              <input
                type="radio"
                name={groupName}
                value={speed.value}
                aria-label={speed.name}
                defaultChecked={speed === originalSpeed}
                onChange={() => { targetRate.current = speed.rpm * 6; }}
              />
              <span aria-hidden="true">
                {speed.value}
                {speed.value === "33" && (
                  <span className={styles.third}><b>1</b><b>3</b></span>
                )}
              </span>
            </label>
          ))}
          <span className={styles.track} aria-hidden="true" />
          <span className={styles.slide} aria-hidden="true">
            <span className={styles.knob} />
          </span>
        </fieldset>
      </div>
    </div>
  );
}

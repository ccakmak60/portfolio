"use client";

import { useEffect, useId, useRef, useState } from "react";
import { capitals, numerals, setLine, small, type Face } from "./glyphs";
import styles from "./board.module.css";

const showings = [
  { time: "7:20", title: "Glass Orchard", screen: 2, minutes: 107, seats: 6 },
  { time: "7:45", title: "Kestrel", screen: 1, minutes: 101, seats: 57 },
  { time: "8:10", title: "Everything We Owe the River", screen: 3, minutes: 128, seats: 38 },
  { time: "8:30", title: "Salt Hymn", screen: 5, minutes: 114, seats: 0 },
  { time: "9:00", title: "Moths", screen: 4, minutes: 92, seats: 23 },
];

type Showing = (typeof showings)[number];
type Run = [Face, string][];
const titleWidth = 95;
const two = (n: number) => String(n).padStart(2, "0");

// Work in lamp cells. Each cell occupies four pixels on the full-size board.
function lettering(parts: Run) {
  let width = 0;
  let path = "";
  for (const [face, text] of parts) {
    const line = setLine(face, text);
    for (const [x, y] of line.lamps) {
      path += `M${width + x + 0.5} ${y + 0.5 + (face === small ? 2 : 0)}h0`;
    }
    width += line.width + 2;
  }
  return { path, width: width - 2 };
}

function seatLabel(count: number): Run {
  if (!count) return [[small, "SOLD OUT"]];
  if (count < 10) return [[small, "LAST"], [capitals, String(count)]];
  return [[capitals, String(count)], [small, "SEATS"]];
}

function Ink({ id, scarce = false }: { id: string; scarce?: boolean }) {
  return (
    <g className={scarce ? styles.scarce : undefined}>
      <use href={`#${id}`} stroke="var(--lamp)" strokeWidth=".725" />
      <use href={`#${id}`} stroke="var(--core)" strokeWidth=".375" />
    </g>
  );
}

function Header() {
  const [elapsed, setElapsed] = useState(0);
  const id = useId();
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 60000)), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const date = new Date(Date.UTC(2026, 10, 21, 19, 12 + elapsed));
  const hour = date.getUTCHours();
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).replaceAll(",", "").toUpperCase();
  const hourText = lettering([[capitals, String(hour % 12 || 12)]]);
  const minuteText = lettering([[capitals, two(date.getUTCMinutes())]]);
  const suffix = lettering([[capitals, hour < 12 ? "AM" : "PM"]]);
  const minutesX = 132 - suffix.width - 4 - minuteText.width;
  return (
    <svg viewBox="0 0 135 15" role="img" aria-label={`${day}, ${hour % 12 || 12}:${two(date.getUTCMinutes())} ${hour < 12 ? "AM" : "PM"}`}>
      <defs>
        <g id={id} transform="translate(0 4)">
          <path d={lettering([[capitals, day]]).path} transform="translate(3)" />
          <path d={hourText.path} transform={`translate(${minutesX - 5 - hourText.width})`} />
          <path d={lettering([[capitals, ":"]]).path} transform={`translate(${minutesX - 3})`} className={styles.colon} />
          <path d={minuteText.path} transform={`translate(${minutesX})`} />
          <path d={suffix.path} transform={`translate(${132 - suffix.width})`} />
        </g>
      </defs>
      <g className={styles.glow}><Ink id={id} /></g>
    </svg>
  );
}

function useMarquee(loop: number, selected: boolean) {
  const [shift, setShift] = useState(0);
  const position = useRef(0);
  useEffect(() => {
    if (!loop) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let frame = 0;
    function move(value: number) {
      position.current = value;
      setShift(value);
    }
    function update() {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      if (motion.matches) {
        move(0);
      } else if (selected) {
        function step() {
          move((position.current + 1) % loop);
          timer = window.setTimeout(step, position.current === 0 ? 2800 : 48);
        }
        timer = window.setTimeout(step, position.current === 0 ? 1400 : 48);
      } else if (position.current) {
        const from = position.current;
        const to = from > loop / 2 ? loop : 0;
        const start = performance.now();
        function rewind(now: number) {
          const progress = Math.min(1, (now - start) / (240 + Math.abs(to - from) * 5));
          move(Math.round(to + (from - to) * (1 - progress) ** 3) % loop);
          if (progress < 1) frame = requestAnimationFrame(rewind);
        }
        frame = requestAnimationFrame(rewind);
      }
    }
    update();
    motion.addEventListener("change", update);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", update);
    };
  }, [loop, selected]);
  return shift;
}

function prepareShowing(show: Showing) {
  const screen = lettering([[small, "SCREEN"], [capitals, String(show.screen)]]);
  const duration = lettering([[small, `${Math.floor(show.minutes / 60)}H${two(show.minutes % 60)}`]]);
  return {
    ...show,
    screenLabel: screen,
    duration,
    titleLabel: lettering([[capitals, show.title.toUpperCase()]]),
    timeLabel: lettering([[numerals, show.time]]),
    seatsLabel: lettering(seatLabel(show.seats)),
  };
}

const rows = showings.map(prepareShowing);

function ShowingRow({ show, selected, onSelect, group }: {
  show: (typeof rows)[number];
  selected: boolean;
  onSelect: () => void;
  group: string;
}) {
  const id = useId();
  const loop = show.titleLabel.width > titleWidth ? show.titleLabel.width + 18 : 0;
  const shift = useMarquee(loop, selected);
  return (
    <label className={styles.row}>
      <input type="radio" name={group} checked={selected} disabled={!show.seats} onChange={onSelect}
        aria-label={`${show.time} ${show.title}, screen ${show.screen}, ${show.minutes} minutes, ${show.seats ? `${show.seats} seats left` : "sold out"}`} />
      <svg viewBox="0 0 135 24" aria-hidden="true">
        <defs>
          <g id={id + "-info"}>
            <path d={show.timeLabel.path} transform="translate(3 4)" />
            <svg x="37" y="4" width={titleWidth} height="7" overflow="hidden">
              <g transform={`translate(${-shift})`}>
                <path d={show.titleLabel.path} />
                {loop > 0 && <path d={show.titleLabel.path} transform={`translate(${loop})`} />}
              </g>
            </svg>
            <path d={show.screenLabel.path} transform="translate(37 13)" />
            <path d={show.duration.path} transform={`translate(${37 + show.screenLabel.width + 9} 13)`} />
          </g>
          <path id={id + "-seats"} d={show.seatsLabel.path} transform={`translate(${132 - show.seatsLabel.width} 13)`} />
        </defs>
        <g className={styles.ink}>
          <g className={styles.glow}><Ink id={id + "-info"} /></g>
          <Ink id={id + "-seats"} scarce={show.seats < 10} />
        </g>
        <g className={styles.band}>
          <rect y="1" width="135" height="22" fill={`url(#${group}-lit)`} />
          {[id + "-info", id + "-seats"].map(ref => (
            <g key={ref}>
              <use href={`#${ref}`} stroke="#050506" strokeWidth="1" strokeLinecap="square" />
              <use href={`#${ref}`} stroke="#1c1d21" strokeWidth=".65" />
            </g>
          ))}
        </g>
        <g className={styles.focusRing}>
          <rect width="135" height="1" fill={`url(#${group}-focus)`} />
          <rect y="23" width="135" height="1" fill={`url(#${group}-focus)`} />
        </g>
      </svg>
    </label>
  );
}

export default function CinemaBoard() {
  const [selected, setSelected] = useState(showings[0].time);
  const group = useId();
  return (
    <div className={styles.board}>
      <svg width="0" height="0" className={styles.patterns} aria-hidden="true">
        <defs>
          <pattern id={group + "-lit"} width="1" height="1" patternUnits="userSpaceOnUse">
            <circle cx=".5" cy=".5" r=".36" fill="#e4ecff" />
            <circle cx=".5" cy=".5" r=".19" fill="white" />
          </pattern>
          <pattern id={group + "-focus"} width="2" height="1" patternUnits="userSpaceOnUse">
            <circle cx=".5" cy=".5" r=".36" fill="white" />
          </pattern>
        </defs>
      </svg>
      <Header />
      <fieldset aria-label="Tonight’s showings">
        {rows.map(show => (
          <ShowingRow
            key={show.time}
            show={show}
            group={group}
            selected={selected === show.time}
            onSelect={() => setSelected(show.time)}
          />
        ))}
      </fieldset>
    </div>
  );
}

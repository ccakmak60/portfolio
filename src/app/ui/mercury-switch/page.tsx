import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import MercurySwitch from "./MercurySwitch";

const besley = localFont({
  src: [
    { path: "./besley-latin-wght-normal.woff2", weight: "400 900", style: "normal" },
    { path: "./besley-latin-wght-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-mercury-label",
});

const jost = localFont({
  src: "../turntable/jost-latin.woff2",
  weight: "100 900",
  variable: "--font-mercury-dial",
});

export const metadata: Metadata = {
  title: "Mercury Switch · Cem Cakmak",
  description: "An interactive mercury tilt switch with a glass capsule and a glowing pilot light.",
};

export default function MercurySwitchPage() {
  return (
    <main className="page">
      <article className="page-container case-study">
        <header>
          <div className="page-header-row">
            <Link className="text-link" href="/#ui-work">Back to UI work</Link>
            <ThemeToggle />
          </div>
          <h1 className="hero-title">Mercury Switch</h1>
          <p className="hero-tagline">Drag the glass tube, or use Enter or Space to toggle the heating.</p>
        </header>
        <div className={`${besley.variable} ${jost.variable}`}>
          <MercurySwitch />
        </div>
      </article>
    </main>
  );
}

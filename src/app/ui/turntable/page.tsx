import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Turntable from "./Turntable";

export const metadata: Metadata = {
  title: "Turntable · Cem Cakmak",
  description: "An interactive record player with a three-speed selector.",
};

export default function TurntablePage() {
  return (
    <main className="page">
      <article className="page-container case-study">
        <header>
          <div className="page-header-row">
            <Link className="text-link" href="/#ui-work">Back to UI work</Link>
            <ThemeToggle />
          </div>
          <h1 className="hero-title">Turntable</h1>
          <p className="hero-tagline">Select an RPM or use the arrow keys to change the record speed.</p>
        </header>
        <Turntable />
      </article>
    </main>
  );
}

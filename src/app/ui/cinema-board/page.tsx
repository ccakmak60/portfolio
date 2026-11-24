import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import CinemaBoard from "./CinemaBoard";

export const metadata: Metadata = {
  title: "Cinema board · Cem Cakmak",
  description: "An interactive dot-matrix cinema showtime selector.",
};

export default function CinemaBoardPage() {
  return (
    <main className="page">
      <article className="page-container case-study">
        <header>
          <div className="page-header-row">
            <Link className="text-link" href="/#ui-work">Back to UI work</Link>
            <ThemeToggle />
          </div>
          <h1 className="hero-title">Cinema board</h1>
          <p className="hero-tagline">Select a showing by clicking a row or using the arrow keys.</p>
        </header>
        <CinemaBoard />
      </article>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import WeightStrings from "./WeightStrings";

export const metadata: Metadata = {
  title: "Weight Strings · Cem Cakmak",
  description: "An interactive variable-font weight selector with pluckable strings.",
};

export default function WeightStringsPage() {
  return (
    <main className="page">
      <article className="page-container case-study">
        <header>
          <div className="page-header-row">
            <Link className="text-link" href="/#ui-work">Back to UI work</Link>
            <ThemeToggle />
          </div>
          <h1 className="hero-title">Weight Strings</h1>
          <p className="hero-tagline">Pluck a string, select a row, or use the arrow keys to change the type weight.</p>
        </header>
        <WeightStrings />
      </article>
    </main>
  );
}

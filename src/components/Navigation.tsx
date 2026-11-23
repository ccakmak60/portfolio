"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const sections = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/engineering/", label: "AI engineering", icon: "⌁" },
  { href: "/projects/", label: "Projects", icon: "▤" },
];

export default function Navigation() {
  const path = usePathname().replace(/\/$/, "");
  return <aside>
    <Link className="identity" href="/">
      <span className="mark" aria-hidden="true">j.</span>
      <span><strong>Jem</strong><small>AI engineer</small></span>
    </Link>
    <nav aria-label="Portfolio">{sections.map(({href, label, icon}) =>
      <Link key={href} href={href} aria-current={path === href.replace(/\/$/, "") ? "page" : undefined}>
        <span className="glyph" aria-hidden="true">{icon}</span>{label}
      </Link>)}</nav>
    <div className="tools"><a href="https://github.com/ccakmak60">GitHub</a><ThemeToggle /></div>
  </aside>;
}

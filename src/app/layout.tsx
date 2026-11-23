import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Navigation from "@/components/Navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Jem · AI engineer", template: "%s · Jem" },
  description: "AI engineering projects by Jem, including EarCue’s evaluation dashboard, retrieval experiments and agent tooling.",
};

const themeInitScript = `
  (function () {
    var d = document.documentElement, t = localStorage.getItem("theme");
    if (t !== "light") d.classList.add("dark");
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body><a className="skip" href="#main">Skip to content</a><div className="shell"><Navigation /><main id="main">{children}</main></div></body>
    </html>
  );
}

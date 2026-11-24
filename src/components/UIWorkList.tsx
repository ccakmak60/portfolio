"use client";

import type { FocusEvent, ReactNode } from "react";

function revealFocusedCard(event: FocusEvent<HTMLUListElement>) {
  if (event.target.matches(":focus-visible")) {
    event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

export default function UIWorkList({ children }: { children: ReactNode }) {
  return <ul role="list" onFocus={revealFocusedCard}>{children}</ul>;
}

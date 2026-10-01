"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark switch (PRD §4.1 requires dark mode support).
 *
 * Light is the default, declared in tokens.css as `:root` — so a first-time
 * visitor gets light with no JavaScript and no flash. Dark is opt-in via
 * `data-theme="dark"` on <html>, which the layout's inline script restores
 * before paint on later visits.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Read the attribute the pre-paint script already set, so the control
  // reflects reality rather than assuming the default.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("medanchor-theme", next);
    } catch {
      /* storage unavailable — the choice still applies for this page view */
    }
  }

  return (
    <button
      className="theme-switch"
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
    </button>
  );
}

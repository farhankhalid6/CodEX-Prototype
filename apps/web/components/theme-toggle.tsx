"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { setStoredTheme } from "@/lib/client-storage";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    setStoredTheme(next ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-btn"
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
    >
      {light ? <IconMoon /> : <IconSun />}
    </button>
  );
}

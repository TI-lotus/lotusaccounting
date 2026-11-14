import { useState, useEffect, useCallback, useRef } from "react";

type Theme = "light" | "dark";

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("lotus-theme") as Theme;
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const themeRef = useRef<Theme>(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme | ((current: Theme) => Theme)) => {
    const resolved = typeof next === "function" ? next(themeRef.current) : next;
    themeRef.current = resolved;
    setThemeState(resolved);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<Theme>("lotus-theme-change", { detail: resolved }));
    }
  }, []);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (next !== "light" && next !== "dark") return;
      themeRef.current = next;
      setThemeState(next);
    };
    window.addEventListener("lotus-theme-change", handleThemeChange);
    return () => window.removeEventListener("lotus-theme-change", handleThemeChange);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    const themeColor = window.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = theme === "dark" ? "#141414" : "#ffffff";
    }
    localStorage.setItem("lotus-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, setTheme, toggleTheme };
};

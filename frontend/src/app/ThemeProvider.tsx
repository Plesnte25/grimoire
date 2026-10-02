import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type TextSize = "small" | "default" | "large";

type ThemeContextValue = {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  reduceMotion: boolean;
  setReduceMotion: (reduce: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const TEXT_SCALE: Record<TextSize, string> = {
  small: "92%",
  default: "100%",
  large: "110%",
};

function readChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  const value = localStorage.getItem(key);
  return options.includes(value as T) ? (value as T) : fallback;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() =>
    readChoice("grimoire-theme", ["system", "light", "dark"], "system"),
  );
  const [textSize, setTextSizeState] = useState<TextSize>(() =>
    readChoice("grimoire-text-size", ["small", "default", "large"], "default"),
  );
  const [reduceMotion, setReduceMotionState] = useState(
    () => localStorage.getItem("grimoire-reduced-motion") === "true",
  );

  useEffect(() => {
    const root = document.documentElement;
    const system = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      root.dataset.theme = theme === "system" ? (system.matches ? "light" : "dark") : theme;
    };
    applyTheme();
    system.addEventListener("change", applyTheme);
    return () => system.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", TEXT_SCALE[textSize]);
  }, [textSize]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduceMotion);
  }, [reduceMotion]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next) => {
        localStorage.setItem("grimoire-theme", next);
        setThemeState(next);
      },
      textSize,
      setTextSize: (next) => {
        localStorage.setItem("grimoire-text-size", next);
        setTextSizeState(next);
      },
      reduceMotion,
      setReduceMotion: (next) => {
        localStorage.setItem("grimoire-reduced-motion", String(next));
        setReduceMotionState(next);
      },
    }),
    [theme, textSize, reduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

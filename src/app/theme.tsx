import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export type ThemeSetting = "light" | "dark" | "auto";
const KEY = "fb-clone:theme";

const ThemeContext = createContext<{
  setting: ThemeSetting;
  setSetting: (s: ThemeSetting) => void;
} | null>(null);

function readSetting(): ThemeSetting {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(readSetting);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, setting);
    } catch {
      // Non-persistent storage is fine; the choice applies for this session.
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = setting === "dark" || (setting === "auto" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [setting]);

  return <ThemeContext.Provider value={{ setting, setSetting }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

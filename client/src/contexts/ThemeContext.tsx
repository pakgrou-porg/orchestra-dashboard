/**
 * ThemeProvider — hard-coded dark theme. The toggle/switchable feature
 * existed as dead code in the original; we keep the provider interface
 * in case a theme picker is added later.
 */
import React, { createContext, useContext } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: ThemeProviderProps) {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
    if (defaultTheme === "light") {
      document.documentElement.classList.remove("dark");
    }
  }, [defaultTheme]);

  return (
    <ThemeContext.Provider value={{ theme: defaultTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
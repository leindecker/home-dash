'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeCtx {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ isDark: true, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) setIsDark(saved === 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
    document.body.style.background = isDark ? '#0F1117' : '#f0f4f8';
    document.body.style.color     = isDark ? '#ffffff' : '#111827';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => setIsDark((v) => !v) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useTokens() {
  const { isDark } = useTheme();
  return {
    isDark,
    pageBg:     isDark ? '#0F1117'                      : '#f0f4f8',
    sidebarBg:  isDark ? '#13151F'                      : '#f1f5f9',
    cardBg:     isDark ? '#1A1D27'                      : '#ffffff',
    cardBorder: isDark ? '#2A2D3A'                      : '#e2e8f0',
    textMain:   isDark ? '#ffffff'                      : '#111827',
    textMuted:  isDark ? '#71717a'                      : '#6b7280',
    rowBg:      isDark ? 'rgba(255,255,255,0.04)'       : 'rgba(0,0,0,0.03)',
  };
}

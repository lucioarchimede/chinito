import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('ecomdash-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ecomdash-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function useChartTheme() {
  const { dark } = useTheme();
  return {
    grid: dark ? '#1e293b' : '#f1f5f9',
    tick: { fill: dark ? '#64748b' : '#94a3b8', fontSize: 11 },
    tooltipStyle: {
      backgroundColor: dark ? '#0f172a' : '#ffffff',
      border: `1px solid ${dark ? '#1e293b' : '#e2e8f0'}`,
      borderRadius: 10,
      color: dark ? '#f8fafc' : '#0f172a',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)',
      padding: '8px 12px',
    },
    gradientOpacity: dark ? 0.25 : 0.15,
  };
}

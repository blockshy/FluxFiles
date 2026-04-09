import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useI18n } from '../i18n/LocaleProvider';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const storageKey = 'fluxfiles-theme-mode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(storageKey);
  return stored === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    document.body.dataset.theme = themeMode;
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(storageKey, themeMode);
  }, [themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode,
      toggleTheme: () => setThemeMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [themeMode],
  );

  const configTheme =
    themeMode === 'dark'
      ? {
          algorithm: antdTheme.darkAlgorithm,
          token: {
            colorPrimary: '#d4d8df',
            colorBgBase: '#101317',
            colorTextBase: '#eef2f7',
            colorBorder: '#2d3642',
            borderRadius: 10,
            wireframe: false,
            fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
          },
        }
      : {
          algorithm: antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#20242c',
            colorBgBase: '#f3f4f6',
            colorTextBase: '#17181b',
            colorBorder: '#d5d8dd',
            borderRadius: 10,
            wireframe: false,
            fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
          },
        };

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={locale === 'zh-CN' ? zhCN : enUS} theme={configTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}

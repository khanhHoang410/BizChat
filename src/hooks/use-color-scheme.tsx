import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemePreference = 'light' | 'dark' | 'system';

type ColorSchemeContextValue = {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => Promise<void>;
  resolvedScheme: 'light' | 'dark';
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

const STORAGE_KEY = 'themePreference';

export function AppColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const resolvedScheme: 'light' | 'dark' = (preference === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : preference);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value = useMemo<ColorSchemeContextValue>(() => ({
    preference,
    setPreference,
    resolvedScheme,
  }), [preference, setPreference, resolvedScheme]);

  return (
    <ColorSchemeContext.Provider value={value}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useAppColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error('useAppColorScheme must be used within AppColorSchemeProvider');
  return ctx;
}

// Backward-compatible hook name used across the app
export function useColorScheme() {
  const { resolvedScheme } = useAppColorScheme();
  return resolvedScheme;
}

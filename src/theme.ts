import { createContext, useContext } from 'react'

export const darkColors = {
  background: '#0f1117',
  surface: '#1a1d27',
  surfaceHover: '#252833',
  border: '#2d3140',
  text: '#e8eaed',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
}

export const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceHover: '#f0f0f0',
  border: '#e0e0e0',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#888888',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
}

export type ThemeColors = typeof darkColors

// Default export fuer bestehende Imports (wird zur Laufzeit ueberschrieben)
export let colors = darkColors

export function setThemeColors(dark: boolean) {
  const newColors = dark ? darkColors : lightColors
  Object.assign(colors, newColors)
}

export type ThemeMode = 'dark' | 'light'

export const ThemeContext = createContext<{
  mode: ThemeMode
  colors: ThemeColors
  toggle: () => void
}>({
  mode: 'dark',
  colors: darkColors,
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

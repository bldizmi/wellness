import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'neutral';
export type ThemeVariant = 0 | 1 | 2 | 3 | 4;

export interface ThemeConfig {
  mode: ThemeMode;
  variant: ThemeVariant;
}

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  updateMode: (mode: ThemeMode) => void;
  updateVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme definitions
export const THEME_COLORS = {
  dark: [
    { name: 'Deep Purple', color: '#744FA0', id: 'deep-purple' },
    { name: 'Soft Lilac', color: '#BFA4E9', id: 'soft-lilac' },
    { name: 'Steel Blue', color: '#6CA7DC', id: 'steel-blue' },
    { name: 'Dark Mint', color: '#3B7D62', id: 'dark-mint' },
    { name: 'Clay Pink', color: '#C79F9F', id: 'clay-pink' },
  ],
  light: [
    { name: 'Lavender', color: '#EEE6FD', id: 'lavender' },
    { name: 'Lilac', color: '#D4B8FF', id: 'lilac' },
    { name: 'Sky Blue', color: '#C4E1FF', id: 'sky-blue' },
    { name: 'Mint', color: '#E6F6EB', id: 'mint' },
    { name: 'Peach', color: '#FFE3D3', id: 'peach' },
  ],
  neutral: [
    { name: 'Warm Sand', color: '#F5EFE6', id: 'warm-sand' },
    { name: 'Clay Beige', color: '#E2D3C2', id: 'clay-beige' },
    { name: 'Rosewood Tan', color: '#D8B4A0', id: 'rosewood-tan' },
    { name: 'Soft Cocoa', color: '#B08968', id: 'soft-cocoa' },
    { name: 'Deep Walnut', color: '#5C3A21', id: 'deep-walnut' },
  ],
};

// Helper function to convert hex to HSL values for CSS variables
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>({
    mode: 'dark',
    variant: 0, // Deep Purple as default
  });

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('wellness-theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setThemeState(parsed);
      } catch (error) {
        console.error('Failed to parse saved theme:', error);
      }
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = THEME_COLORS[theme.mode][theme.variant];
    const accentColor = currentTheme.color;
    const hslColor = hexToHsl(accentColor);

    // Remove existing theme classes
    root.classList.remove(...Array.from(root.classList).filter(cls => cls.startsWith('theme-')));
    
    // Add new theme class
    root.classList.add(`theme-${theme.mode}-${currentTheme.id}`);
    
    // Add mode class for base styling
    if (theme.mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light', 'neutral');
    } else if (theme.mode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark', 'neutral');
    } else {
      root.classList.add('neutral');
      root.classList.remove('dark', 'light');
    }

    // Set CSS custom properties for the accent color
    root.style.setProperty('--accent-primary', accentColor);
    root.style.setProperty('--accent-primary-hsl', hslColor);
    
    // Generate variations
    const [h, s, l] = hslColor.split(' ').map(v => parseFloat(v));
    root.style.setProperty('--accent-secondary', `hsl(${h} ${s}% ${Math.min(l + 10, 95)}%)`);
    root.style.setProperty('--accent-muted', `hsl(${h} ${s}% ${l}% / 0.1)`);
    root.style.setProperty('--accent-border', `hsl(${h} ${s}% ${l}% / 0.3)`);
    root.style.setProperty('--accent-hover', `hsl(${h} ${s}% ${Math.max(l - 5, 5)}%)`);

  }, [theme]);

  const setTheme = (newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    localStorage.setItem('wellness-theme', JSON.stringify(newTheme));
  };

  const updateMode = (mode: ThemeMode) => {
    setTheme({ ...theme, mode });
  };

  const updateVariant = (variant: ThemeVariant) => {
    setTheme({ ...theme, variant });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, updateMode, updateVariant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function getThemeDisplayName(theme: ThemeConfig): string {
  const modeNames = {
    dark: 'Dark Mode',
    light: 'Light Mode', 
    neutral: 'Neutral Mode'
  };
  
  const colorName = THEME_COLORS[theme.mode][theme.variant].name;
  return `${modeNames[theme.mode]} - ${colorName}`;
}
/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';


export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// constants/theme.ts

// Định nghĩa type cho theme
export type Theme = {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  // Thêm các properties mới
  tint: string;
  secondaryTint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  messageSent: string;
  messageReceived: string;
  onlineStatus: string;
  offlineStatus: string;
  cardBackground: string;
  borderColor: string;
  primaryText: string;
  secondaryText: string;
  lightPurple: string;
  error: string;
  success: string;
  warning: string;
};

export const Colors: { light: Theme; dark: Theme } = {
  light: {
    // Properties có sẵn
    text: '#333333',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    
    // Properties mới từ login
    tint: '#667eea',
    secondaryTint: '#764ba2',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#667eea',
    messageSent: '#667eea',
    messageReceived: '#E9E9EB',
    onlineStatus: '#34C759',
    offlineStatus: '#8E8E93',
    cardBackground: '#FFFFFF',
    borderColor: '#F0F0F0',
    primaryText: '#333333',
    secondaryText: '#666666',
    lightPurple: '#f8f9ff',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
  dark: {
    // Properties có sẵn
    text: '#FFFFFF',
    background: '#121212',
    backgroundElement: '#1E1E1E',
    backgroundSelected: '#2C2C2E',
    textSecondary: '#8E8E93',
    
    // Properties mới cho dark mode
    tint: '#818cf8',
    secondaryTint: '#a78bfa',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#818cf8',
    messageSent: '#818cf8',
    messageReceived: '#2C2C2E',
    onlineStatus: '#32D74B',
    offlineStatus: '#8E8E93',
    cardBackground: '#1C1C1E',
    borderColor: '#2C2C2E',
    primaryText: '#FFFFFF',
    secondaryText: '#8E8E93',
    lightPurple: '#2C2C2E',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
  },
};

// Gradients
export const Gradients = {
  primary: ['#667eea', '#764ba2'] as const,
  secondary: ['#818cf8', '#a78bfa'] as const,
  success: ['#34C759', '#30B0C7'] as const,
  error: ['#FF3B30', '#FF9500'] as const,
};

// Font sizes
export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};


export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

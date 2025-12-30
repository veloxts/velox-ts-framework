/**
 * VeloxTS Design System
 *
 * Dark mode theme constants extracted from the SPA template.
 * This is the single source of truth for all RSC template styling.
 */

/**
 * Color palette - Dark mode with cyan accents
 */
export const colors = {
  // Backgrounds
  background: '#0a0a0a',
  backgroundAlt: '#111',
  surface: '#111',
  surfaceHover: '#1a1a1a',
  surfaceAlt: '#1a1a1a',

  // Borders
  border: '#222',
  borderHover: '#333',
  borderFocus: '#00d9ff',

  // Text
  text: '#ededed',
  textMuted: '#888',
  textDimmed: '#666',
  textInverse: '#000',

  // Accent & Brand
  accent: '#00d9ff',
  accentHover: 'rgba(0, 217, 255, 0.8)',
  accentDimmed: 'rgba(0, 217, 255, 0.6)',

  // Semantic Colors
  success: '#00d9ff',
  error: '#ff4444',
  errorBg: '#2a1111',
  errorText: '#ff6666',
  warning: '#ffaa00',
  warningBg: '#2a2211',
  info: '#00d9ff',

  // Selection
  selection: '#00d9ff',
  selectionText: '#000',

  // Scrollbar
  scrollbarTrack: '#111',
  scrollbarThumb: '#333',
  scrollbarThumbHover: '#444',

  // Code blocks
  codeBg: '#1a1a1a',
} as const;

/**
 * Typography
 */
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Monaco, "Courier New", monospace',
  },
  fontSize: {
    xs: '0.625rem', // 10px
    sm: '0.75rem', // 12px
    base: '0.875rem', // 14px
    md: '0.9rem', // 14.4px
    lg: '1rem', // 16px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '2rem', // 32px
    '4xl': '2.5rem', // 40px
    '5xl': '3rem', // 48px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    normal: '1.6',
    relaxed: '1.8',
  },
} as const;

/**
 * Spacing scale (based on 0.25rem = 4px)
 */
export const spacing = {
  0: '0',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
  20: '5rem', // 80px
} as const;

/**
 * Layout constants
 */
export const layout = {
  maxWidth: '1200px',
  maxWidthNarrow: '1000px',
  maxWidthWide: '1400px',
  navHeight: '64px',
  sidebarWidth: '240px',
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  boxShadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 2px 8px rgba(0, 0, 0, 0.4)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.5)',
  },
} as const;

/**
 * Transitions
 */
export const transitions = {
  fast: '0.1s',
  normal: '0.2s',
  slow: '0.3s',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
} as const;

/**
 * Z-index layers
 */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 100,
  fixed: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
} as const;

/**
 * CSS Generator Functions
 *
 * Generates CSS strings from the theme design system.
 * These functions provide consistent dark mode styling across all RSC templates.
 */

import { colors, typography, spacing, layout, transitions } from './theme.js';

/**
 * Global CSS reset and base styles for dark mode
 */
export function generateGlobalReset(): string {
  return `
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font: inherit;
    }

    html {
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      background: ${colors.background};
      color: ${colors.text};
      font-family: ${typography.fontFamily.sans};
      line-height: ${typography.lineHeight.normal};
      min-height: 100svh;
    }

    h1, h2, h3, h4, h5, h6 {
      text-wrap: balance;
    }

    p, li, figcaption {
      text-wrap: pretty;
    }

    img, picture, svg, video, canvas {
      max-width: 100%;
    }

    a {
      color: ${colors.accent};
      text-decoration: none;
      transition: opacity ${transitions.normal};
    }

    a:hover {
      opacity: 0.8;
    }

    code {
      font-family: ${typography.fontFamily.mono};
      background: ${colors.codeBg};
      padding: 0.2em 0.4em;
      border-radius: ${layout.borderRadius.sm};
      font-size: ${typography.fontSize.md};
    }

    ::selection {
      background: ${colors.selection};
      color: ${colors.selectionText};
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: ${colors.scrollbarTrack};
    }

    ::-webkit-scrollbar-thumb {
      background: ${colors.scrollbarThumb};
      border-radius: ${layout.borderRadius.sm};
    }

    ::-webkit-scrollbar-thumb:hover {
      background: ${colors.scrollbarThumbHover};
    }
  `.trim();
}

/**
 * Root layout styles - Navigation, footer, and main content area
 */
export function generateRscRootStyles(): string {
  return `
    ${generateGlobalReset()}

    .layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .nav {
      background: ${colors.surface};
      padding: ${spacing[4]} ${spacing[8]};
      border-bottom: 1px solid ${colors.border};
    }

    .nav-list {
      display: flex;
      gap: ${spacing[8]};
      list-style: none;
      max-width: ${layout.maxWidth};
      margin: 0 auto;
      align-items: center;
    }

    .nav-link {
      color: ${colors.text};
      text-decoration: none;
      font-weight: ${typography.fontWeight.medium};
      transition: color ${transitions.normal};
      padding: ${spacing[2]} ${spacing[3]};
      border-radius: ${layout.borderRadius.sm};
    }

    .nav-link:hover {
      color: ${colors.accent};
      background: ${colors.surfaceHover};
    }

    .main {
      flex: 1;
      padding: ${spacing[8]};
      max-width: ${layout.maxWidth};
      margin: 0 auto;
      width: 100%;
    }

    .footer {
      background: ${colors.surface};
      color: ${colors.textMuted};
      text-align: center;
      padding: ${spacing[4]};
      font-size: ${typography.fontSize.base};
      border-top: 1px solid ${colors.border};
    }

    /* Home page hero section */
    .home-page .hero {
      text-align: center;
      padding: ${spacing[12]} 0;
    }

    .home-page h1 {
      font-size: ${typography.fontSize['4xl']};
      margin-bottom: ${spacing[3]};
      font-weight: ${typography.fontWeight.bold};
    }

    .home-page .tagline {
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.xl};
    }

    /* Stats cards */
    .stats {
      display: flex;
      gap: ${spacing[4]};
      justify-content: center;
      margin: ${spacing[8]} 0;
      flex-wrap: wrap;
    }

    .stat-card {
      background: ${colors.surface};
      padding: ${spacing[6]} ${spacing[8]};
      border-radius: ${layout.borderRadius.lg};
      border: 1px solid ${colors.border};
      text-align: center;
      min-width: 150px;
      transition: border-color ${transitions.normal};
    }

    .stat-card:hover {
      border-color: ${colors.accent};
    }

    .stat-value {
      display: block;
      font-size: ${typography.fontSize['3xl']};
      font-weight: ${typography.fontWeight.bold};
      color: ${colors.accent};
    }

    .stat-label {
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.base};
      margin-top: ${spacing[2]};
    }

    /* Features section */
    .features {
      background: ${colors.surface};
      padding: ${spacing[8]};
      border-radius: ${layout.borderRadius.lg};
      border: 1px solid ${colors.border};
      margin-top: ${spacing[8]};
    }

    .features h2 {
      margin-bottom: ${spacing[6]};
      font-size: ${typography.fontSize['2xl']};
      font-weight: ${typography.fontWeight.semibold};
    }

    .features ul {
      list-style: none;
    }

    .features li {
      padding: ${spacing[3]} 0;
      border-bottom: 1px solid ${colors.border};
      color: ${colors.text};
    }

    .features li:last-child {
      border-bottom: none;
    }

    .cta {
      text-align: center;
      margin-top: ${spacing[8]};
      color: ${colors.textMuted};
    }

    /* Users page */
    .users-page h1 {
      margin-bottom: ${spacing[6]};
      font-size: ${typography.fontSize['3xl']};
      font-weight: ${typography.fontWeight.bold};
    }

    .empty-state {
      color: ${colors.textMuted};
      padding: ${spacing[8]};
      text-align: center;
      background: ${colors.surface};
      border-radius: ${layout.borderRadius.lg};
      border: 1px solid ${colors.border};
    }

    .user-list {
      list-style: none;
      display: grid;
      gap: ${spacing[4]};
    }

    .user-card {
      background: ${colors.surface};
      padding: ${spacing[4]};
      border-radius: ${layout.borderRadius.lg};
      border: 1px solid ${colors.border};
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color ${transitions.normal};
    }

    .user-card:hover {
      border-color: ${colors.accent};
    }

    .user-name {
      font-weight: ${typography.fontWeight.semibold};
      color: ${colors.text};
    }

    .user-email {
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.base};
    }

    /* About page */
    .about-page h1 {
      font-size: ${typography.fontSize['3xl']};
      margin-bottom: ${spacing[6]};
      font-weight: ${typography.fontWeight.bold};
    }

    .about-page h2 {
      font-size: ${typography.fontSize['2xl']};
      margin-top: ${spacing[8]};
      margin-bottom: ${spacing[4]};
      font-weight: ${typography.fontWeight.semibold};
    }

    .about-page p {
      color: ${colors.textMuted};
      margin-bottom: ${spacing[4]};
      line-height: ${typography.lineHeight.relaxed};
    }
  `.trim();
}

/**
 * Dashboard layout styles - Sidebar navigation
 */
export function generateRscDashboardStyles(): string {
  return `
    .dashboard-layout {
      display: flex;
      gap: ${spacing[8]};
      min-height: 60vh;
    }

    .dashboard-sidebar {
      width: ${layout.sidebarWidth};
      flex-shrink: 0;
      background: ${colors.surface};
      border-radius: ${layout.borderRadius.lg};
      padding: ${spacing[6]};
      border: 1px solid ${colors.border};
      height: fit-content;
    }

    .dashboard-sidebar h3 {
      font-size: ${typography.fontSize.sm};
      text-transform: uppercase;
      color: ${colors.textMuted};
      margin-bottom: ${spacing[3]};
      padding: 0 ${spacing[3]};
      font-weight: ${typography.fontWeight.semibold};
      letter-spacing: 0.05em;
    }

    .sidebar-nav {
      list-style: none;
    }

    .sidebar-nav a {
      display: block;
      padding: ${spacing[3]};
      color: ${colors.text};
      text-decoration: none;
      border-radius: ${layout.borderRadius.sm};
      transition: background ${transitions.normal};
    }

    .sidebar-nav a:hover {
      background: ${colors.surfaceHover};
      color: ${colors.accent};
    }

    .sidebar-nav a.active {
      background: ${colors.accent};
      color: ${colors.textInverse};
    }

    .dashboard-content {
      flex: 1;
      background: ${colors.surface};
      border-radius: ${layout.borderRadius.lg};
      padding: ${spacing[6]};
      border: 1px solid ${colors.border};
    }

    .dashboard-badge {
      display: inline-block;
      background: ${colors.accent};
      color: ${colors.textInverse};
      font-size: ${typography.fontSize.xs};
      text-transform: uppercase;
      padding: ${spacing[2]} ${spacing[3]};
      border-radius: ${layout.borderRadius.sm};
      margin-bottom: ${spacing[4]};
      font-weight: ${typography.fontWeight.semibold};
      letter-spacing: 0.05em;
    }
  `.trim();
}

/**
 * Minimal layout styles - For auth pages, centered content
 */
export function generateRscMinimalStyles(): string {
  return `
    ${generateGlobalReset()}

    .minimal-body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: ${spacing[8]};
    }

    .minimal-content {
      width: 100%;
      max-width: 450px;
    }

    /* Auth card container */
    .auth-card {
      background: ${colors.surface};
      padding: ${spacing[8]};
      border-radius: ${layout.borderRadius.lg};
      border: 1px solid ${colors.border};
    }

    .auth-card h1 {
      font-size: ${typography.fontSize['2xl']};
      font-weight: ${typography.fontWeight.bold};
      margin-bottom: ${spacing[6]};
      text-align: center;
    }

    /* Form styles */
    .auth-form {
      margin-top: ${spacing[6]};
    }

    .form-group {
      margin-bottom: ${spacing[5]};
    }

    .form-label {
      display: block;
      margin-bottom: ${spacing[2]};
      color: ${colors.text};
      font-weight: ${typography.fontWeight.medium};
      font-size: ${typography.fontSize.base};
    }

    .form-input {
      width: 100%;
      padding: ${spacing[3]} ${spacing[4]};
      border-radius: ${layout.borderRadius.sm};
      border: 1px solid ${colors.border};
      background: ${colors.background};
      color: ${colors.text};
      font-size: ${typography.fontSize.base};
      transition: border-color ${transitions.normal}, background ${transitions.normal};
    }

    .form-input:focus {
      outline: none;
      border-color: ${colors.borderFocus};
      background: ${colors.surface};
    }

    .form-input:hover {
      border-color: ${colors.borderHover};
    }

    .form-hint {
      display: block;
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.sm};
      margin-top: ${spacing[2]};
    }

    /* Buttons */
    .btn {
      width: 100%;
      padding: ${spacing[3]} ${spacing[5]};
      border: none;
      border-radius: ${layout.borderRadius.sm};
      cursor: pointer;
      font-weight: ${typography.fontWeight.medium};
      font-size: ${typography.fontSize.base};
      transition: background ${transitions.normal}, opacity ${transitions.normal};
    }

    .btn-primary {
      background: ${colors.accent};
      color: ${colors.textInverse};
    }

    .btn-primary:hover:not(:disabled) {
      background: ${colors.accentHover};
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Error message */
    .error-message {
      padding: ${spacing[3]};
      background: ${colors.errorBg};
      color: ${colors.errorText};
      border-radius: ${layout.borderRadius.sm};
      margin-bottom: ${spacing[4]};
      border: 1px solid ${colors.error};
      font-size: ${typography.fontSize.base};
    }

    /* Footer text */
    .auth-footer {
      margin-top: ${spacing[6]};
      text-align: center;
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.base};
    }

    .auth-footer a {
      color: ${colors.accent};
      font-weight: ${typography.fontWeight.medium};
    }

    .auth-footer a:hover {
      opacity: 0.8;
    }
  `.trim();
}

/**
 * Marketing layout styles - Banner/badge
 */
export function generateRscMarketingStyles(): string {
  return `
    .marketing-layout {
      position: relative;
    }

    .marketing-banner {
      background: ${colors.surface};
      border: 1px solid ${colors.border};
      border-radius: ${layout.borderRadius.lg};
      padding: ${spacing[4]} ${spacing[6]};
      margin-bottom: ${spacing[6]};
      display: flex;
      align-items: center;
      gap: ${spacing[4]};
    }

    .marketing-banner .badge {
      display: inline-block;
      background: ${colors.accent};
      color: ${colors.textInverse};
      font-size: ${typography.fontSize.xs};
      text-transform: uppercase;
      padding: ${spacing[2]} ${spacing[3]};
      border-radius: ${layout.borderRadius.sm};
      font-weight: ${typography.fontWeight.semibold};
      letter-spacing: 0.05em;
    }

    .marketing-banner span:not(.badge) {
      color: ${colors.textMuted};
      font-size: ${typography.fontSize.base};
    }
  `.trim();
}

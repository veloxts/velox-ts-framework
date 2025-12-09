/**
 * Web Package Styles
 *
 * CSS templates for React frontend (global.css, App.module.css)
 */

import type { TemplateFile } from '../types.js';

// ============================================================================
// Global CSS
// ============================================================================

export function generateGlobalCss(): string {
  return `/* Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background: #0a0a0a;
  color: #ededed;
  line-height: 1.6;
  min-height: 100vh;
}

a {
  color: #00d9ff;
  text-decoration: none;
  transition: opacity 0.2s;
}

a:hover {
  opacity: 0.8;
}

code {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Monaco, 'Courier New', monospace;
  background: #1a1a1a;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}

::selection {
  background: #00d9ff;
  color: #000;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #111;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #444;
}
`;
}

// ============================================================================
// App Module CSS
// ============================================================================

export function generateAppModuleCss(): string {
  return `/* App Styles */

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Navigation */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #111;
  border-bottom: 1px solid #222;
}

.navBrand {
  display: flex;
  align-items: center;
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #00d9ff;
  text-decoration: none;
}

.logo:hover {
  opacity: 1;
  color: #00d9ff;
}

.navLinks {
  display: flex;
  gap: 1.5rem;
}

.navLink {
  color: #888;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}

.navLink:hover {
  color: #fff;
  opacity: 1;
}

.navLinkActive {
  color: #fff;
}

/* Main Content */
.main {
  flex: 1;
  padding: 2rem;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
}

/* Hero Section */
.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #fff 0%, #888 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #888;
  font-size: 1.25rem;
}

/* Cards Grid */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.card {
  background: #111;
  border: 1px solid #222;
  border-radius: 12px;
  padding: 1.5rem;
  transition: border-color 0.2s, transform 0.2s;
}

.card:hover {
  border-color: #333;
  transform: translateY(-2px);
}

.card h2 {
  font-size: 1.1rem;
  color: #fff;
  margin-bottom: 1rem;
}

.card p {
  color: #888;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.card a {
  display: inline-block;
  margin-top: 0.25rem;
}

/* Status Indicators */
.loading {
  color: #888;
}

.success {
  color: #00d9ff;
  font-weight: 600;
}

.error {
  color: #ff4444;
  font-weight: 600;
}

.meta {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.5rem;
}

/* Auth Card */
.authCard {
  background: #111;
  border: 1px solid #222;
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  margin: 0 auto;
}

.authTabs {
  display: flex;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #222;
}

.authTab {
  flex: 1;
  padding: 0.75rem;
  background: transparent;
  border: none;
  color: #666;
  font-size: 1rem;
  cursor: pointer;
  transition: color 0.2s;
}

.authTab:hover {
  color: #888;
}

.authTabActive {
  color: #fff;
  border-bottom: 2px solid #00d9ff;
  margin-bottom: -1px;
}

/* Forms */
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input {
  padding: 0.875rem 1rem;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #00d9ff;
}

.input::placeholder {
  color: #555;
}

.button {
  padding: 0.875rem 1.5rem;
  background: #00d9ff;
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.button:hover {
  opacity: 0.9;
}

.button:active {
  transform: scale(0.98);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.formError {
  color: #ff4444;
  font-size: 0.9rem;
  text-align: center;
}

.formHint {
  color: #666;
  font-size: 0.85rem;
  text-align: center;
  margin-top: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .nav {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }

  .navLinks {
    width: 100%;
    justify-content: center;
  }

  .main {
    padding: 1rem;
  }

  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .authCard {
    padding: 1.5rem;
  }
}
`;
}

// ============================================================================
// Generate All Style Files
// ============================================================================

export function generateWebStyleFiles(): TemplateFile[] {
  return [
    { path: 'apps/web/src/styles/global.css', content: generateGlobalCss() },
    { path: 'apps/web/src/App.module.css', content: generateAppModuleCss() },
  ];
}

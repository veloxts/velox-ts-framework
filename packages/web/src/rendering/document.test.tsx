/**
 * Tests for Document Component
 */

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Document } from './document.js';

// Helper to render async component
async function renderDocument(props: Parameters<typeof Document>[0]): Promise<string> {
  const element = await Document(props);
  return renderToString(element);
}

describe('Document component', () => {
  describe('basic structure', () => {
    it('should render basic HTML structure', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      // Note: renderToString doesn't include DOCTYPE
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should render with default lang attribute', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      expect(html).toContain('lang="en"');
    });

    it('should render with custom lang attribute', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        lang: 'fr',
      });

      expect(html).toContain('lang="fr"');
    });

    it('should include charset meta tag', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      // React uses camelCase attribute names
      expect(html).toContain('charSet="UTF-8"');
    });

    it('should include viewport meta tag', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      expect(html).toContain('name="viewport"');
      expect(html).toContain('width=device-width');
    });

    it('should render root element with id', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      expect(html).toContain('id="root"');
    });
  });

  describe('children rendering', () => {
    it('should render children inside root element', async () => {
      const html = await renderDocument({
        children: <div data-testid="child">Hello World</div>,
      });

      expect(html).toContain('Hello World');
      expect(html).toContain('data-testid="child"');
    });

    it('should render complex children', async () => {
      const html = await renderDocument({
        children: (
          <div>
            <h1>Title</h1>
            <p>Paragraph</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        ),
      });

      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<p>Paragraph</p>');
      expect(html).toContain('<li>Item 1</li>');
    });

    it('should render text children', async () => {
      const html = await renderDocument({
        children: 'Plain text content',
      });

      expect(html).toContain('Plain text content');
    });
  });

  describe('head content', () => {
    it('should render custom head content', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        head: <title>My App</title>,
      });

      expect(html).toContain('<title>My App</title>');
    });

    it('should render multiple head elements', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        head: (
          <>
            <title>My App</title>
            <meta name="description" content="App description" />
          </>
        ),
      });

      expect(html).toContain('<title>My App</title>');
      expect(html).toContain('name="description"');
      expect(html).toContain('content="App description"');
    });
  });

  describe('scripts', () => {
    it('should render no scripts by default', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      // Should only have the inline style, no script tags for bootstrap
      const scriptMatches = html.match(/<script[^>]*src=/g);
      expect(scriptMatches).toBeNull();
    });

    it('should render single script', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        scripts: ['/client.js'],
      });

      expect(html).toContain('src="/client.js"');
      expect(html).toContain('type="module"');
    });

    it('should render multiple scripts', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        scripts: ['/vendor.js', '/client.js'],
      });

      expect(html).toContain('src="/vendor.js"');
      expect(html).toContain('src="/client.js"');
    });

    it('should render scripts with async attribute', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        scripts: ['/app.js'],
      });

      expect(html).toMatch(/async/);
    });
  });

  describe('initial data', () => {
    it('should not render data script when no initial data', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      expect(html).not.toContain('__velox_data__');
    });

    it('should render initial data as JSON script', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        initialData: { user: { id: '1', name: 'John' } },
      });

      expect(html).toContain('id="__velox_data__"');
      expect(html).toContain('type="application/json"');
    });

    it('should escape special characters in initial data', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        initialData: { script: '<script>alert("xss")</script>' },
      });

      // Should escape < and > to prevent XSS
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('\\u003c');
    });

    it('should handle null initial data', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        initialData: null,
      });

      expect(html).toContain('__velox_data__');
      expect(html).toContain('null');
    });

    it('should handle array initial data', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        initialData: [1, 2, 3],
      });

      expect(html).toContain('__velox_data__');
      expect(html).toContain('[1,2,3]');
    });

    it('should handle nested objects', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
        initialData: {
          user: {
            profile: {
              settings: { theme: 'dark' },
            },
          },
        },
      });

      expect(html).toContain('theme');
      expect(html).toContain('dark');
    });
  });

  describe('inline styles', () => {
    it('should include base styles for body and root', async () => {
      const html = await renderDocument({
        children: <div>Content</div>,
      });

      expect(html).toContain('margin: 0');
      expect(html).toContain('font-family');
      expect(html).toContain('min-height: 100vh');
    });
  });

  describe('async behavior', () => {
    it('should be an async function', () => {
      const result = Document({ children: <div>Test</div> });
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve to a valid React element', async () => {
      const element = await Document({ children: <div>Test</div> });
      expect(element).toBeDefined();
      expect(element.type).toBe('html');
    });
  });
});

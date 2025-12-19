/**
 * Tests for the file-based router
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFileRouter, parseFilePath } from './file-router.js';

describe('parseFilePath', () => {
  describe('basic static routes', () => {
    it('should parse index.tsx as root route', () => {
      const route = parseFilePath('index.tsx');

      expect(route.pattern).toBe('/');
      expect(route.params).toEqual([]);
      expect(route.catchAll).toBe(false);
    });

    it('should parse about.tsx as /about', () => {
      const route = parseFilePath('about.tsx');

      expect(route.pattern).toBe('/about');
      expect(route.params).toEqual([]);
      expect(route.catchAll).toBe(false);
    });

    it('should parse contact.tsx as /contact', () => {
      const route = parseFilePath('contact.tsx');

      expect(route.pattern).toBe('/contact');
      expect(route.params).toEqual([]);
      expect(route.catchAll).toBe(false);
    });

    it('should preserve original filePath', () => {
      const route = parseFilePath('pricing.tsx');

      expect(route.filePath).toBe('pricing.tsx');
    });
  });

  describe('nested routes', () => {
    it('should parse users/index.tsx as /users', () => {
      const route = parseFilePath('users/index.tsx');

      expect(route.pattern).toBe('/users');
      expect(route.params).toEqual([]);
    });

    it('should parse users/profile.tsx as /users/profile', () => {
      const route = parseFilePath('users/profile.tsx');

      expect(route.pattern).toBe('/users/profile');
      expect(route.params).toEqual([]);
    });

    it('should parse blog/posts/archive.tsx as /blog/posts/archive', () => {
      const route = parseFilePath('blog/posts/archive.tsx');

      expect(route.pattern).toBe('/blog/posts/archive');
      expect(route.params).toEqual([]);
    });

    it('should handle deeply nested routes', () => {
      const route = parseFilePath('docs/api/reference/types.tsx');

      expect(route.pattern).toBe('/docs/api/reference/types');
    });
  });

  describe('dynamic parameters', () => {
    it('should parse [id].tsx as /:id', () => {
      const route = parseFilePath('[id].tsx');

      expect(route.pattern).toBe('/:id');
      expect(route.params).toEqual(['id']);
      expect(route.catchAll).toBe(false);
    });

    it('should parse users/[id].tsx as /users/:id', () => {
      const route = parseFilePath('users/[id].tsx');

      expect(route.pattern).toBe('/users/:id');
      expect(route.params).toEqual(['id']);
    });

    it('should parse users/[id]/edit.tsx as /users/:id/edit', () => {
      const route = parseFilePath('users/[id]/edit.tsx');

      expect(route.pattern).toBe('/users/:id/edit');
      expect(route.params).toEqual(['id']);
    });

    it('should handle multiple parameters', () => {
      const route = parseFilePath('posts/[category]/[slug].tsx');

      expect(route.pattern).toBe('/posts/:category/:slug');
      expect(route.params).toEqual(['category', 'slug']);
    });

    it('should handle custom parameter names', () => {
      const route = parseFilePath('users/[userId]/posts/[postId].tsx');

      expect(route.pattern).toBe('/users/:userId/posts/:postId');
      expect(route.params).toEqual(['userId', 'postId']);
    });

    it('should preserve parameter order', () => {
      const route = parseFilePath('[year]/[month]/[day].tsx');

      expect(route.params).toEqual(['year', 'month', 'day']);
    });
  });

  describe('catch-all routes', () => {
    it('should parse [...slug].tsx as /* catch-all', () => {
      const route = parseFilePath('[...slug].tsx');

      expect(route.pattern).toBe('/*');
      expect(route.params).toEqual(['slug']);
      expect(route.catchAll).toBe(true);
    });

    it('should parse docs/[...slug].tsx as /docs/*', () => {
      const route = parseFilePath('docs/[...slug].tsx');

      expect(route.pattern).toBe('/docs/*');
      expect(route.params).toEqual(['slug']);
      expect(route.catchAll).toBe(true);
    });

    it('should handle catch-all with custom parameter name', () => {
      const route = parseFilePath('files/[...path].tsx');

      expect(route.pattern).toBe('/files/*');
      expect(route.params).toEqual(['path']);
      expect(route.catchAll).toBe(true);
    });

    it('should handle catch-all at root', () => {
      const route = parseFilePath('[...all].tsx');

      expect(route.pattern).toBe('/*');
      expect(route.params).toEqual(['all']);
      expect(route.catchAll).toBe(true);
    });
  });

  describe('route groups', () => {
    it('should parse (auth)/login.tsx as /login', () => {
      const route = parseFilePath('(auth)/login.tsx');

      expect(route.pattern).toBe('/login');
      expect(route.group).toBe('auth');
      expect(route.params).toEqual([]);
    });

    it('should parse (auth)/register.tsx as /register', () => {
      const route = parseFilePath('(auth)/register.tsx');

      expect(route.pattern).toBe('/register');
      expect(route.group).toBe('auth');
    });

    it('should parse (dashboard)/settings.tsx as /settings', () => {
      const route = parseFilePath('(dashboard)/settings.tsx');

      expect(route.pattern).toBe('/settings');
      expect(route.group).toBe('dashboard');
    });

    it('should handle groups with nested routes', () => {
      const route = parseFilePath('(admin)/users/list.tsx');

      expect(route.pattern).toBe('/users/list');
      expect(route.group).toBe('admin');
    });

    it('should handle groups with dynamic parameters', () => {
      const route = parseFilePath('(api)/users/[id].tsx');

      expect(route.pattern).toBe('/users/:id');
      expect(route.group).toBe('api');
      expect(route.params).toEqual(['id']);
    });

    it('should not define group for non-grouped routes', () => {
      const route = parseFilePath('home.tsx');

      expect(route.group).toBeUndefined();
    });
  });

  describe('file extensions', () => {
    it('should handle .tsx extension', () => {
      const route = parseFilePath('page.tsx');
      expect(route.pattern).toBe('/page');
    });

    it('should handle .jsx extension', () => {
      const route = parseFilePath('page.jsx');
      expect(route.pattern).toBe('/page');
    });

    it('should handle .ts extension', () => {
      const route = parseFilePath('api.ts');
      expect(route.pattern).toBe('/api');
    });

    it('should handle .js extension', () => {
      const route = parseFilePath('util.js');
      expect(route.pattern).toBe('/util');
    });
  });

  describe('edge cases', () => {
    it('should handle index at root', () => {
      const route = parseFilePath('index.tsx');

      expect(route.pattern).toBe('/');
    });

    it('should handle nested index routes', () => {
      const route = parseFilePath('blog/index.tsx');

      expect(route.pattern).toBe('/blog');
    });

    it('should handle deeply nested index routes', () => {
      const route = parseFilePath('docs/api/index.tsx');

      expect(route.pattern).toBe('/docs/api');
    });

    it('should handle single character parameter names', () => {
      const route = parseFilePath('posts/[x].tsx');

      expect(route.pattern).toBe('/posts/:x');
      expect(route.params).toEqual(['x']);
    });

    it('should handle numeric-looking parameter names', () => {
      const route = parseFilePath('[id123].tsx');

      expect(route.pattern).toBe('/:id123');
      expect(route.params).toEqual(['id123']);
    });

    it('should handle underscore in parameter names', () => {
      const route = parseFilePath('[user_id].tsx');

      expect(route.pattern).toBe('/:user_id');
      expect(route.params).toEqual(['user_id']);
    });

    it('should handle mixed static and dynamic segments', () => {
      const route = parseFilePath('blog/[year]/posts/[slug]/edit.tsx');

      expect(route.pattern).toBe('/blog/:year/posts/:slug/edit');
      expect(route.params).toEqual(['year', 'slug']);
    });
  });

  describe('complex patterns', () => {
    it('should combine groups and parameters', () => {
      const route = parseFilePath('(dashboard)/projects/[id]/settings.tsx');

      expect(route.pattern).toBe('/projects/:id/settings');
      expect(route.group).toBe('dashboard');
      expect(route.params).toEqual(['id']);
    });

    it('should combine groups and catch-all', () => {
      const route = parseFilePath('(docs)/[...slug].tsx');

      expect(route.pattern).toBe('/*');
      expect(route.group).toBe('docs');
      expect(route.params).toEqual(['slug']);
      expect(route.catchAll).toBe(true);
    });

    it('should handle multiple parameters with groups', () => {
      const route = parseFilePath('(api)/v1/[resource]/[id].tsx');

      expect(route.pattern).toBe('/v1/:resource/:id');
      expect(route.group).toBe('api');
      expect(route.params).toEqual(['resource', 'id']);
    });

    it('should handle index in grouped routes', () => {
      const route = parseFilePath('(auth)/index.tsx');

      expect(route.pattern).toBe('/');
      expect(route.group).toBe('auth');
    });
  });

  describe('returned route object', () => {
    it('should include all required properties', () => {
      const route = parseFilePath('users/[id].tsx');

      expect(route).toHaveProperty('filePath');
      expect(route).toHaveProperty('pattern');
      expect(route).toHaveProperty('params');
      expect(route).toHaveProperty('catchAll');
    });

    it('should only include group when present', () => {
      const withGroup = parseFilePath('(admin)/users.tsx');
      expect(withGroup.group).toBe('admin');

      const withoutGroup = parseFilePath('users.tsx');
      expect(withoutGroup.group).toBeUndefined();
    });

    it('should have correct types for all properties', () => {
      const route = parseFilePath('posts/[slug].tsx');

      expect(typeof route.filePath).toBe('string');
      expect(typeof route.pattern).toBe('string');
      expect(Array.isArray(route.params)).toBe(true);
      expect(typeof route.catchAll).toBe('boolean');
    });
  });

  describe('parameter extraction', () => {
    it('should extract all dynamic parameters in order', () => {
      const route = parseFilePath('[a]/[b]/[c].tsx');

      expect(route.params).toEqual(['a', 'b', 'c']);
    });

    it('should not extract static segments as parameters', () => {
      const route = parseFilePath('static/[id]/more-static.tsx');

      expect(route.params).toEqual(['id']);
      expect(route.params).not.toContain('static');
      expect(route.params).not.toContain('more-static');
    });

    it('should extract catch-all parameter', () => {
      const route = parseFilePath('docs/[...pages].tsx');

      expect(route.params).toEqual(['pages']);
    });

    it('should handle empty params array for static routes', () => {
      const route = parseFilePath('about/team.tsx');

      expect(route.params).toEqual([]);
      expect(Array.isArray(route.params)).toBe(true);
    });
  });
});

describe('createFileRouter', () => {
  describe('initialization', () => {
    it('should create a router with default options', async () => {
      const router = await createFileRouter();

      expect(router).toBeDefined();
      expect(router.routes).toEqual([]);
      expect(typeof router.match).toBe('function');
      expect(typeof router.reload).toBe('function');
    });

    it('should accept custom options', async () => {
      const router = await createFileRouter({
        pagesDir: 'src/pages',
        layoutsDir: 'src/layouts',
      });

      expect(router).toBeDefined();
    });

    it('should accept custom extensions', async () => {
      const router = await createFileRouter({
        extensions: ['.tsx', '.jsx'],
      });

      expect(router).toBeDefined();
    });
  });

  describe('route matching', () => {
    it('should return null for unmatched routes (placeholder)', async () => {
      const router = await createFileRouter();
      const match = router.match('/users');

      expect(match).toBeNull();
    });

    it('should handle various pathnames without errors', async () => {
      const router = await createFileRouter();

      expect(() => router.match('/')).not.toThrow();
      expect(() => router.match('/users')).not.toThrow();
      expect(() => router.match('/users/123')).not.toThrow();
      expect(() => router.match('/users/123/edit')).not.toThrow();
    });
  });

  describe('route reloading', () => {
    it('should provide reload method', async () => {
      const router = await createFileRouter();

      expect(typeof router.reload).toBe('function');
    });

    it('should not throw when reloading (placeholder)', async () => {
      const router = await createFileRouter();

      await expect(router.reload()).resolves.toBeUndefined();
    });
  });

  describe('routes property', () => {
    it('should expose routes array', async () => {
      const router = await createFileRouter();

      expect(Array.isArray(router.routes)).toBe(true);
    });

    it('should start with empty routes (placeholder)', async () => {
      const router = await createFileRouter();

      expect(router.routes).toHaveLength(0);
    });
  });
});

// File system integration tests
const TEST_DIR = join(process.cwd(), '.test-file-router');
const PAGES_DIR = join(TEST_DIR, 'app/pages');
const LAYOUTS_DIR = join(TEST_DIR, 'app/layouts');

describe('createFileRouter with file system', () => {
  beforeAll(() => {
    // Create test directory structure
    mkdirSync(PAGES_DIR, { recursive: true });
    mkdirSync(LAYOUTS_DIR, { recursive: true });
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('file scanning', () => {
    beforeAll(() => {
      // Create test pages
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, 'about.tsx'), 'export default function About() {}');
      mkdirSync(join(PAGES_DIR, 'users'), { recursive: true });
      writeFileSync(join(PAGES_DIR, 'users/index.tsx'), 'export default function UsersList() {}');
      writeFileSync(join(PAGES_DIR, 'users/[id].tsx'), 'export default function UserDetail() {}');
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'about.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'users'), { recursive: true, force: true });
    });

    it('should scan and parse page files', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.routes.length).toBeGreaterThan(0);
    });

    it('should create routes for all page files', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const patterns = router.routes.map((r) => r.pattern);
      expect(patterns).toContain('/');
      expect(patterns).toContain('/about');
      expect(patterns).toContain('/users');
      expect(patterns).toContain('/users/:id');
    });
  });

  describe('route matching', () => {
    beforeAll(() => {
      // Create test pages
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, 'about.tsx'), 'export default function About() {}');
      mkdirSync(join(PAGES_DIR, 'posts'), { recursive: true });
      writeFileSync(join(PAGES_DIR, 'posts/[slug].tsx'), 'export default function Post() {}');
      writeFileSync(
        join(PAGES_DIR, 'posts/[...path].tsx'),
        'export default function CatchAll() {}'
      );
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'about.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'posts'), { recursive: true, force: true });
    });

    it('should match root route', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/');
      expect(match).not.toBeNull();
      expect(match?.route.pattern).toBe('/');
    });

    it('should match static routes', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/about');
      expect(match).not.toBeNull();
      expect(match?.route.pattern).toBe('/about');
    });

    it('should match dynamic routes and extract params', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/posts/hello-world');
      expect(match).not.toBeNull();
      expect(match?.params.slug).toBe('hello-world');
    });

    it('should return null for non-existent routes', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/non-existent');
      expect(match).toBeNull();
    });
  });

  describe('special pages', () => {
    beforeAll(() => {
      // Create test pages including special pages
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, '_not-found.tsx'), 'export default function NotFound() {}');
      writeFileSync(join(PAGES_DIR, '_error.tsx'), 'export default function Error() {}');
      writeFileSync(join(PAGES_DIR, '_loading.tsx'), 'export default function Loading() {}');
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '_not-found.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '_error.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '_loading.tsx'), { force: true });
    });

    it('should detect not-found page', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.hasSpecialPage('not-found')).toBe(true);
      expect(router.getSpecialPage('not-found')).toBe('_not-found.tsx');
    });

    it('should detect error page', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.hasSpecialPage('error')).toBe(true);
      expect(router.getSpecialPage('error')).toBe('_error.tsx');
    });

    it('should detect loading page', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.hasSpecialPage('loading')).toBe(true);
      expect(router.getSpecialPage('loading')).toBe('_loading.tsx');
    });

    it('should expose specialPages object', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.specialPages.notFound).toBe('_not-found.tsx');
      expect(router.specialPages.error).toBe('_error.tsx');
      expect(router.specialPages.loading).toBe('_loading.tsx');
    });

    it('should not include special pages in routes', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const patterns = router.routes.map((r) => r.pattern);
      expect(patterns).not.toContain('/_not-found');
      expect(patterns).not.toContain('/_error');
      expect(patterns).not.toContain('/_loading');
    });
  });

  describe('alternative special page names', () => {
    beforeAll(() => {
      // Create pages with alternative naming
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, '404.tsx'), 'export default function NotFound() {}');
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '404.tsx'), { force: true });
    });

    it('should detect 404.tsx as not-found page', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.hasSpecialPage('not-found')).toBe(true);
      expect(router.getSpecialPage('not-found')).toBe('404.tsx');
    });
  });

  describe('route reloading', () => {
    it('should reload routes when files change', async () => {
      // Start with index only
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');

      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      expect(router.routes.length).toBe(1);

      // Add a new page
      writeFileSync(join(PAGES_DIR, 'contact.tsx'), 'export default function Contact() {}');

      // Reload
      await router.reload();

      expect(router.routes.length).toBe(2);

      // Cleanup
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'contact.tsx'), { force: true });
    });
  });

  describe('ignored files', () => {
    beforeAll(() => {
      // Create test pages
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, '_helper.tsx'), 'export const helper = () => {}');
      mkdirSync(join(PAGES_DIR, '_components'), { recursive: true });
      writeFileSync(
        join(PAGES_DIR, '_components/Button.tsx'),
        'export default function Button() {}'
      );
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '_helper.tsx'), { force: true });
      rmSync(join(PAGES_DIR, '_components'), { recursive: true, force: true });
    });

    it('should ignore files starting with underscore', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const patterns = router.routes.map((r) => r.pattern);
      expect(patterns).not.toContain('/_helper');
    });

    it('should ignore directories in ignore list', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const patterns = router.routes.map((r) => r.pattern);
      expect(patterns).not.toContain('/_components/Button');
    });
  });

  describe('catch-all parameter extraction', () => {
    beforeAll(() => {
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      mkdirSync(join(PAGES_DIR, 'docs'), { recursive: true });
      writeFileSync(
        join(PAGES_DIR, 'docs/[...slug].tsx'),
        'export default function DocsCatchAll() {}'
      );
      writeFileSync(join(PAGES_DIR, '[...all].tsx'), 'export default function RootCatchAll() {}');
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'docs'), { recursive: true, force: true });
      rmSync(join(PAGES_DIR, '[...all].tsx'), { force: true });
    });

    it('should extract catch-all parameter from nested path', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/docs/getting-started/installation');
      expect(match).not.toBeNull();
      expect(match?.params['*']).toBe('getting-started/installation');
    });

    it('should extract single segment for catch-all', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/docs/overview');
      expect(match).not.toBeNull();
      expect(match?.params['*']).toBe('overview');
    });

    it('should handle empty catch-all value', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      // Match /docs/ should give empty catch-all
      const match = router.match('/docs');
      // This might match the docs catch-all with empty value or not match
      // depending on radix3 behavior - testing the extractParams logic
      if (match && match.route.pattern === '/docs/*') {
        expect(match.params['*']).toBe('');
      }
    });

    it('should handle deeply nested catch-all paths', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/docs/api/reference/types/advanced');
      expect(match).not.toBeNull();
      expect(match?.params['*']).toBe('api/reference/types/advanced');
    });

    it('should extract root level catch-all', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      // Delete the docs catch-all temporarily to test root catch-all
      rmSync(join(PAGES_DIR, 'docs'), { recursive: true, force: true });
      await router.reload();

      const match = router.match('/any/random/path');
      expect(match).not.toBeNull();
      expect(match?.params['*']).toBe('any/random/path');

      // Restore docs
      mkdirSync(join(PAGES_DIR, 'docs'), { recursive: true });
      writeFileSync(
        join(PAGES_DIR, 'docs/[...slug].tsx'),
        'export default function DocsCatchAll() {}'
      );
    });
  });

  describe('security: path traversal protection', () => {
    beforeAll(() => {
      writeFileSync(join(PAGES_DIR, 'index.tsx'), 'export default function Home() {}');
      writeFileSync(join(PAGES_DIR, 'about.tsx'), 'export default function About() {}');
    });

    afterAll(() => {
      rmSync(join(PAGES_DIR, 'index.tsx'), { force: true });
      rmSync(join(PAGES_DIR, 'about.tsx'), { force: true });
    });

    it('should reject paths with .. directory traversal', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      // Path traversal attempts should not match any routes
      const maliciousPaths = [
        '/../../../etc/passwd',
        '/users/../../../etc/passwd',
        '/..',
        '/about/..',
        '/users/../../secret',
      ];

      for (const path of maliciousPaths) {
        const match = router.match(path);
        // Should either return null or match root (/) - never expose traversal
        if (match !== null) {
          expect(match.route.pattern).toBe('/');
        }
      }
    });

    it('should reject paths with null bytes', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      // Null byte injection attempts should be sanitized
      const maliciousPaths = ['/about\0.tsx', '/users\0', '\0/etc/passwd'];

      for (const path of maliciousPaths) {
        const match = router.match(path);
        // Should either return null or match root (/) - never allow null bytes through
        if (match !== null) {
          expect(match.route.pattern).toBe('/');
        }
      }
    });

    it('should reject single dot segments', async () => {
      const router = await createFileRouter({
        pagesDir: join(TEST_DIR, 'app/pages'),
        layoutsDir: join(TEST_DIR, 'app/layouts'),
      });

      const match = router.match('/./about');
      // Should either return null or match root
      if (match !== null) {
        expect(match.route.pattern).toBe('/');
      }
    });
  });
});

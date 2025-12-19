/**
 * Tests for the file-based router
 */

import { describe, expect, it } from 'vitest';

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

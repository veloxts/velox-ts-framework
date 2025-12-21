/**
 * Integration tests for RSC layout rendering patterns
 *
 * These tests verify that the layout wrapping pattern works correctly
 * with React Server Component patterns as used in the RSC template.
 */

import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { LayoutComponent } from './layouts.js';
import { wrapWithLayouts } from './layouts.js';

// Mock layout components that mimic the RSC template pattern
function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: Record<string, string>;
}): React.ReactElement {
  return {
    type: 'html',
    props: {
      lang: 'en',
      children: [
        {
          type: 'head',
          props: {
            children: {
              type: 'title',
              props: { children: 'Test App' },
              key: null,
            },
          },
          key: 'head',
        },
        {
          type: 'body',
          props: {
            children: {
              type: 'div',
              props: {
                className: 'layout',
                children: {
                  type: 'main',
                  props: { children, 'data-params': JSON.stringify(params) },
                  key: null,
                },
              },
              key: null,
            },
          },
          key: 'body',
        },
      ],
    },
    key: null,
  } as unknown as React.ReactElement;
}

function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: Record<string, string>;
}): React.ReactElement {
  return {
    type: 'div',
    props: {
      className: 'dashboard',
      'data-params': JSON.stringify(params),
      children: [
        {
          type: 'aside',
          props: { children: 'Sidebar' },
          key: 'sidebar',
        },
        {
          type: 'div',
          props: { className: 'content', children },
          key: 'content',
        },
      ],
    },
    key: null,
  } as React.ReactElement;
}

function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: Record<string, string>;
}): React.ReactElement {
  return {
    type: 'div',
    props: {
      className: 'admin',
      'data-params': JSON.stringify(params),
      children,
    },
    key: null,
  } as React.ReactElement;
}

describe('RSC Layout Integration', () => {
  describe('single page with root layout', () => {
    it('should render page wrapped in root layout', () => {
      const Page = {
        type: 'div',
        props: { className: 'page', children: 'Home Page' },
        key: null,
      } as React.ReactElement;

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent]);

      expect(result.type).toBe(RootLayout);
      expect(result.props.children).toBe(Page);
    });

    it('should pass route params to root layout', () => {
      const Page = {
        type: 'div',
        props: { children: 'User Profile' },
        key: null,
      } as React.ReactElement;
      const params = { id: 'user-123' };

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent], params);

      expect(result.props.params).toEqual(params);
    });
  });

  describe('nested layouts (root + dashboard)', () => {
    it('should render correct nesting order', () => {
      const Page = {
        type: 'div',
        props: { children: 'Dashboard Page' },
        key: null,
      } as React.ReactElement;

      const result = wrapWithLayouts(Page, [
        RootLayout as LayoutComponent,
        DashboardLayout as LayoutComponent,
      ]);

      // Root should be outermost
      expect(result.type).toBe(RootLayout);

      // Dashboard should be between root and page
      expect(result.props.children.type).toBe(DashboardLayout);

      // Page should be innermost
      expect(result.props.children.props.children).toBe(Page);
    });

    it('should pass params to all layouts in chain', () => {
      const Page = {
        type: 'div',
        props: { children: 'Settings' },
        key: null,
      } as React.ReactElement;
      const params = { section: 'profile' };

      const result = wrapWithLayouts(
        Page,
        [RootLayout as LayoutComponent, DashboardLayout as LayoutComponent],
        params
      );

      expect(result.props.params).toEqual(params);
      expect(result.props.children.props.params).toEqual(params);
    });
  });

  describe('three-level nested layouts', () => {
    it('should handle root + dashboard + admin layouts', () => {
      const Page = {
        type: 'div',
        props: { children: 'Admin Settings' },
        key: null,
      } as React.ReactElement;

      const result = wrapWithLayouts(Page, [
        RootLayout as LayoutComponent,
        DashboardLayout as LayoutComponent,
        AdminLayout as LayoutComponent,
      ]);

      // Verify nesting order: Root > Dashboard > Admin > Page
      expect(result.type).toBe(RootLayout);
      expect(result.props.children.type).toBe(DashboardLayout);
      expect(result.props.children.props.children.type).toBe(AdminLayout);
      expect(result.props.children.props.children.props.children).toBe(Page);
    });

    it('should pass params through all three layout levels', () => {
      const Page = {
        type: 'div',
        props: { children: 'Admin User' },
        key: null,
      } as React.ReactElement;
      const params = { userId: '456', role: 'admin' };

      const result = wrapWithLayouts(
        Page,
        [
          RootLayout as LayoutComponent,
          DashboardLayout as LayoutComponent,
          AdminLayout as LayoutComponent,
        ],
        params
      );

      expect(result.props.params).toEqual(params);
      expect(result.props.children.props.params).toEqual(params);
      expect(result.props.children.props.children.props.params).toEqual(params);
    });
  });

  describe('dynamic routes with params', () => {
    it('should handle single dynamic param', () => {
      const Page = {
        type: 'div',
        props: { children: 'Post Detail' },
        key: null,
      } as React.ReactElement;
      const params = { id: 'post-456' };

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent], params);

      expect(result.props.params).toEqual(params);
    });

    it('should handle multiple dynamic params', () => {
      const Page = {
        type: 'div',
        props: { children: 'Category Post' },
        key: null,
      } as React.ReactElement;
      const params = { category: 'tech', slug: 'react-tips' };

      const result = wrapWithLayouts(
        Page,
        [RootLayout as LayoutComponent, DashboardLayout as LayoutComponent],
        params
      );

      expect(result.props.params).toEqual(params);
      expect(result.props.children.props.params).toEqual(params);
    });

    it('should handle catch-all params', () => {
      const Page = {
        type: 'div',
        props: { children: 'Docs' },
        key: null,
      } as React.ReactElement;
      const params = { slug: 'guides/getting-started/installation' };

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent], params);

      expect(result.props.params).toEqual(params);
    });
  });

  describe('edge cases', () => {
    it('should handle no layouts (direct page render)', () => {
      const Page = {
        type: 'div',
        props: { children: 'Standalone Page' },
        key: null,
      } as React.ReactElement;

      const result = wrapWithLayouts(Page, []);

      expect(result).toBe(Page);
    });

    it('should handle layout with no params', () => {
      const Page = {
        type: 'div',
        props: { children: 'Index' },
        key: null,
      } as React.ReactElement;

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent]);

      expect(result.props.params).toBeUndefined();
    });

    it('should handle empty string params', () => {
      const Page = {
        type: 'div',
        props: { children: 'Search' },
        key: null,
      } as React.ReactElement;
      const params = { query: '', filter: 'all' };

      const result = wrapWithLayouts(Page, [RootLayout as LayoutComponent], params);

      expect(result.props.params).toEqual(params);
    });
  });

  describe('per-route layout configuration', () => {
    it('should allow different layouts for different routes', () => {
      const HomePage = {
        type: 'div',
        props: { children: 'Home' },
        key: null,
      } as React.ReactElement;
      const AdminPage = {
        type: 'div',
        props: { children: 'Admin' },
        key: null,
      } as React.ReactElement;

      // Home page: just root layout
      const homeResult = wrapWithLayouts(HomePage, [RootLayout as LayoutComponent]);
      expect(homeResult.type).toBe(RootLayout);
      expect(homeResult.props.children).toBe(HomePage);

      // Admin page: root + admin layouts
      const adminResult = wrapWithLayouts(AdminPage, [
        RootLayout as LayoutComponent,
        AdminLayout as LayoutComponent,
      ]);
      expect(adminResult.type).toBe(RootLayout);
      expect(adminResult.props.children.type).toBe(AdminLayout);
      expect(adminResult.props.children.props.children).toBe(AdminPage);
    });
  });
});

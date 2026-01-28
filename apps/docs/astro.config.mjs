import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://veloxts.dev',
  base: '/docs',
  outDir: './dist/docs',
  integrations: [
    starlight({
      title: 'Velox TS framework',
      tagline: 'Type-safe from database to UI',
      logo: {
        src: './src/assets/velox-logo.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/veloxts/velox-ts-framework' },
      ],
      editLink: {
        baseUrl: 'https://github.com/veloxts/velox-ts-framework/edit/main/apps/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { slug: 'getting-started/introduction' },
            { slug: 'getting-started/installation' },
            { slug: 'getting-started/quick-start' },
            { slug: 'getting-started/project-structure' },
            { slug: 'getting-started/templates' },
          ],
        },
        {
          label: 'Architecture Guides',
          badge: { text: 'Key', variant: 'tip' },
          items: [
            { slug: 'architecture/overview' },
            { slug: 'architecture/rest-api' },
            { slug: 'architecture/trpc-api' },
            { slug: 'architecture/spa-backend' },
            { slug: 'architecture/fullstack-rsc' },
            { slug: 'architecture/hybrid' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { slug: 'core/application' },
            { slug: 'core/context' },
            { slug: 'core/plugins' },
            { slug: 'core/error-handling' },
            { slug: 'core/configuration' },
          ],
        },
        {
          label: 'Router & Procedures',
          items: [
            { slug: 'router/procedures' },
            { slug: 'router/rest-conventions' },
            { slug: 'router/rest-overrides' },
            { slug: 'router/nested-routes' },
            { slug: 'router/rest-adapter-config' },
            { slug: 'router/trpc-adapter' },
            { slug: 'router/middleware' },
            { slug: 'router/openapi' },
          ],
        },
        {
          label: 'Database',
          items: [
            { slug: 'database/prisma-7-setup' },
            { slug: 'database/driver-adapters' },
            { slug: 'database/migrations' },
            { slug: 'database/seeding' },
            { slug: 'database/testing' },
          ],
        },
        {
          label: 'Validation',
          items: [
            { slug: 'validation/schemas' },
            { slug: 'validation/coercion' },
            { slug: 'validation/pagination' },
            { slug: 'validation/error-handling' },
          ],
        },
        {
          label: 'Authentication',
          items: [
            { slug: 'authentication/overview' },
            { slug: 'authentication/jwt' },
            { slug: 'authentication/sessions' },
            { slug: 'authentication/auth-adapters' },
            { slug: 'authentication/guards' },
            { slug: 'authentication/policies' },
            { slug: 'authentication/password-hashing' },
            { slug: 'authentication/rate-limiting' },
          ],
        },
        {
          label: 'React Server Components',
          items: [
            { slug: 'rsc/overview' },
            { slug: 'rsc/server-actions' },
            { slug: 'rsc/file-routing' },
            { slug: 'rsc/layouts' },
            { slug: 'rsc/trpc-bridge' },
            { slug: 'rsc/client-package' },
          ],
        },
        {
          label: 'CLI',
          items: [
            { slug: 'cli/overview' },
            { slug: 'cli/dev-server' },
            { slug: 'cli/generators' },
            { slug: 'cli/database-commands' },
            { slug: 'cli/mcp-integration' },
          ],
        },
        {
          label: 'Ecosystem',
          collapsed: true,
          items: [
            { slug: 'ecosystem/overview' },
            { slug: 'ecosystem/cache' },
            { slug: 'ecosystem/queue' },
            { slug: 'ecosystem/mail' },
            { slug: 'ecosystem/storage' },
            { slug: 'ecosystem/scheduler' },
            { slug: 'ecosystem/events' },
          ],
        },
        {
          label: 'Advanced',
          collapsed: true,
          items: [
            { slug: 'advanced/type-safety' },
            { slug: 'advanced/dependency-injection' },
            { slug: 'advanced/testing-patterns' },
            { slug: 'advanced/rsc-module-separation' },
          ],
        },
        {
          label: 'Deployment',
          collapsed: true,
          items: [
            { slug: 'deployment/overview' },
            { slug: 'deployment/docker' },
            { slug: 'deployment/railway' },
            { slug: 'deployment/render' },
            { slug: 'deployment/production-checklist' },
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            { slug: 'reference/configuration' },
            { slug: 'reference/environment-variables' },
            { slug: 'reference/error-codes' },
            { slug: 'reference/troubleshooting' },
          ],
        },
      ],
    }),
  ],
});

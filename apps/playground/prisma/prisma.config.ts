/**
 * Prisma 7+ Configuration
 *
 * This file configures the database connection for Prisma CLI operations
 * like migrations and schema push.
 *
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */

import 'dotenv/config';
import path from 'node:path';

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),

  migrations: {
    path: path.join(__dirname, 'migrations'),
  },

  datasource: {
    url: env('DATABASE_URL') ?? 'file:./dev.db',
  },
});

/**
 * Prisma Configuration (Prisma 7.x)
 *
 * Database URL is configured here instead of schema.prisma.
 */

import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});

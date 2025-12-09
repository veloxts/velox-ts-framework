/**
 * Prisma Configuration (Prisma 7.x)
 *
 * Database URL is configured here instead of schema.prisma.
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});

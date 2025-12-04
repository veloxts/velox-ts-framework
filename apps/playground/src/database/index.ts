/**
 * Database Exports
 *
 * Central export point for database configuration.
 */

// Mock client for testing without database
export * from './mock-client.js';
// Real Prisma client (Prisma 7+ with driver adapter)
export { type PrismaClient, prisma } from './prisma.js';

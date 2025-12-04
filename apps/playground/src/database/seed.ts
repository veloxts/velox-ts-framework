/**
 * Database Seed Script
 *
 * Seeds the database with initial test data.
 * Run with: pnpm db:seed
 */

import 'dotenv/config';

import { prisma } from './prisma.js';

const seedUsers = [
  {
    name: 'Alice Johnson',
    email: 'alice@example.com',
  },
  {
    name: 'Bob Smith',
    email: 'bob@example.com',
  },
  {
    name: 'Charlie Brown',
    email: 'charlie@example.com',
  },
];

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.user.deleteMany();
  console.log('Cleared existing users');

  // Create seed users
  for (const userData of seedUsers) {
    const user = await prisma.user.create({
      data: userData,
    });
    console.log(`Created user: ${user.name} (${user.id})`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

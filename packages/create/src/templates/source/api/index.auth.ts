/**
 * Application Entry Point
 */

import 'dotenv/config';

import { veloxApp, databasePlugin, authPlugin, rest } from '@veloxts/velox';
import { config } from './config/app.js';
import { authConfig } from './config/auth.js';
import { prisma } from './config/database.js';
import { authProcedures } from './procedures/auth.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

// Router type for frontend type safety
const router = { auth: authProcedures, health: healthProcedures, users: userProcedures };
export type AppRouter = typeof router;

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: prisma }));
await app.register(authPlugin(authConfig));

app.routes(
  rest([healthProcedures, authProcedures, userProcedures], {
    prefix: config.apiPrefix,
  })
);

await app.start();

/**
 * Application Entry Point
 */

import 'dotenv/config';

import { veloxApp, databasePlugin, authPlugin, rest } from '@veloxts/velox';
import { authConfig, config } from './config/index.js';
import { prisma } from './database/index.js';
import { authProcedures } from './procedures/auth.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

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

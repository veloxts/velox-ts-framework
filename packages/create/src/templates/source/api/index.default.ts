/**
 * Application Entry Point
 */

import 'dotenv/config';

import { veloxApp, databasePlugin, rest } from '@veloxts/velox';
import { config } from './config/app.js';
import { prisma } from './config/database.js';
import { healthProcedures } from './procedures/health.js';
import { userProcedures } from './procedures/users.js';

const app = await veloxApp({
  port: config.port,
  host: config.host,
  logger: config.logger,
});

await app.register(databasePlugin({ client: prisma }));

app.routes(
  rest([healthProcedures, userProcedures], {
    prefix: config.apiPrefix,
  })
);

await app.start();

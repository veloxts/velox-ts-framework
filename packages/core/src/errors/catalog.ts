/**
 * Error Catalog - Centralized error definitions with fix suggestions
 *
 * Error codes follow the pattern: VELOX-XYYY or VELOX-XXYYY
 * - X/XX: Domain (1=Core, 2=Router, 3=Auth, 4=ORM, 5=Validation, 6=Client,
 *                 7=Cache, 8=Queue, 9=Mail, 10=Storage, 11=Scheduler, 12=Events)
 * - YYY: Sequential number within domain
 *
 * @module errors/catalog
 */

// ============================================================================
// Error Code Domains
// ============================================================================

/**
 * Error code domain prefixes
 */
export const ERROR_DOMAINS = {
  CORE: 1,
  ROUTER: 2,
  AUTH: 3,
  ORM: 4,
  VALIDATION: 5,
  CLIENT: 6,
  CACHE: 7,
  QUEUE: 8,
  MAIL: 9,
  STORAGE: 10,
  SCHEDULER: 11,
  EVENTS: 12,
} as const;

export type ErrorDomain = keyof typeof ERROR_DOMAINS;

// ============================================================================
// Error Entry Type
// ============================================================================

/**
 * A single error catalog entry with all metadata for developer assistance
 */
export interface ErrorCatalogEntry {
  /** Unique error code (e.g., 'VELOX-1001') */
  code: string;

  /** Short title for the error */
  title: string;

  /** Detailed explanation of why this error occurs */
  description: string;

  /** HTTP status code to use */
  statusCode: number;

  /** Suggested fix with code example */
  fix?: {
    /** What the developer should do */
    suggestion: string;
    /** Code example showing the fix (optional) */
    example?: string;
  };

  /** Link to documentation page */
  docsUrl?: string;

  /** Related error codes */
  seeAlso?: string[];
}

// ============================================================================
// Error Catalog Registry
// ============================================================================

/**
 * The complete error catalog
 * Organized by domain for easy navigation
 */
export const ERROR_CATALOG: Record<string, ErrorCatalogEntry> = {
  // ==========================================================================
  // CORE ERRORS (1XXX)
  // ==========================================================================

  'VELOX-1001': {
    code: 'VELOX-1001',
    title: 'Server Already Running',
    description: 'Attempted to start a VeloxTS server that is already running.',
    statusCode: 500,
    fix: {
      suggestion:
        'Stop the existing server before starting a new one, or check if another process is using the port.',
      example: `// Stop the server before restarting
await app.stop();
await app.start();

// Or check if you're calling start() multiple times
const app = await veloxApp({ port: 3000 });
await app.start(); // Call only once`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-1001',
  },

  'VELOX-1002': {
    code: 'VELOX-1002',
    title: 'Server Not Running',
    description: 'Attempted to stop a VeloxTS server that is not running.',
    statusCode: 500,
    fix: {
      suggestion: 'Ensure the server is started before attempting to stop it.',
      example: `const app = await veloxApp({ port: 3000 });
await app.start(); // Must call start() first
// ... handle requests
await app.stop();  // Now safe to stop`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-1002',
  },

  'VELOX-1003': {
    code: 'VELOX-1003',
    title: 'Plugin Registration Failed',
    description: 'A plugin failed to register with the VeloxTS application.',
    statusCode: 500,
    fix: {
      suggestion:
        'Check that the plugin is correctly configured and all required dependencies are available.',
      example: `// Ensure plugin is awaited and properly configured
await app.register(databasePlugin({
  client: prisma  // Required: pass Prisma client
}));

// Check plugin order - some plugins depend on others
await app.register(databasePlugin({ client: prisma }));
await app.register(authPlugin(authConfig)); // Auth needs database`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-1003',
  },

  'VELOX-1004': {
    code: 'VELOX-1004',
    title: 'Configuration Error',
    description: 'The VeloxTS application configuration is invalid or incomplete.',
    statusCode: 500,
    fix: {
      suggestion: 'Review your configuration options and ensure all required fields are provided.',
      example: `// Correct configuration
const app = await veloxApp({
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  logger: process.env.NODE_ENV !== 'test',
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-1004',
  },

  'VELOX-1005': {
    code: 'VELOX-1005',
    title: 'Invalid Plugin Metadata',
    description: 'A plugin was registered without required metadata (name, version).',
    statusCode: 500,
    fix: {
      suggestion: 'Ensure your plugin exports proper metadata.',
      example: `// Plugin must have name property
const myPlugin: VeloxPlugin = {
  name: 'my-plugin',
  version: '1.0.0',  // Optional but recommended
  register: async (app) => {
    // Plugin logic
  }
};`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-1005',
  },

  // ==========================================================================
  // ROUTER ERRORS (2XXX)
  // ==========================================================================

  'VELOX-2001': {
    code: 'VELOX-2001',
    title: 'Procedure Missing Input Schema',
    description: 'A procedure was defined without an input schema, but receives input data.',
    statusCode: 500,
    fix: {
      suggestion: 'Add .input() to your procedure definition with a Zod schema.',
      example: `export const getUser = procedure()
  .input(z.object({ id: z.string().uuid() }))  // Add input schema
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findUnique({ where: { id: input.id } });
  });`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2001',
    seeAlso: ['VELOX-2002'],
  },

  'VELOX-2002': {
    code: 'VELOX-2002',
    title: 'Procedure Missing Output Schema',
    description:
      'A procedure was defined without an output schema. Output schemas ensure type safety.',
    statusCode: 500,
    fix: {
      suggestion: 'Add .output() to your procedure definition for type-safe responses.',
      example: `export const getUser = procedure()
  .input(z.object({ id: z.string().uuid() }))
  .output(UserSchema)  // Add output schema
  .query(async ({ input, ctx }) => {
    return ctx.db.user.findUnique({ where: { id: input.id } });
  });`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2002',
    seeAlso: ['VELOX-2001'],
  },

  'VELOX-2003': {
    code: 'VELOX-2003',
    title: 'Guard Authorization Failed',
    description: 'A guard prevented access to a procedure. The user lacks required permissions.',
    statusCode: 403,
    fix: {
      suggestion: 'Ensure the user is authenticated and has the required roles/permissions.',
      example: `// Using built-in guards
const protectedProcedure = procedure()
  .guard(authenticated)  // Requires valid auth
  .query(({ ctx }) => ctx.user);

// Check user has required role
const adminProcedure = procedure()
  .guard(hasRole('admin'))
  .mutation(({ input }) => { /* ... */ });`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2003',
  },

  'VELOX-2004': {
    code: 'VELOX-2004',
    title: 'Duplicate Procedure Name',
    description: 'Two procedures in the same collection have the same name.',
    statusCode: 500,
    fix: {
      suggestion: 'Ensure all procedure names within a collection are unique.',
      example: `// Wrong: duplicate names
const userProcedures = defineProcedures('users', {
  getUser: procedure()...,
  getUser: procedure()...,  // Error: duplicate!
});

// Correct: unique names
const userProcedures = defineProcedures('users', {
  getUser: procedure()...,
  getUserProfile: procedure()...,  // Different name
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2004',
  },

  'VELOX-2005': {
    code: 'VELOX-2005',
    title: 'Invalid REST Method Override',
    description: 'The .rest() configuration contains an invalid HTTP method.',
    statusCode: 500,
    fix: {
      suggestion: 'Use a valid HTTP method: GET, POST, PUT, PATCH, or DELETE.',
      example: `// Correct usage
const updateUser = procedure()
  .rest({ method: 'PUT', path: '/users/:id' })
  .input(UpdateUserSchema)
  .mutation(({ input }) => { /* ... */ });`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2005',
  },

  'VELOX-2006': {
    code: 'VELOX-2006',
    title: 'No Procedures Provided',
    description: 'serve() was called without any procedure collections.',
    statusCode: 500,
    fix: {
      suggestion: 'Pass at least one procedure collection to serve().',
      example: `// Define your procedures
const userProcedures = defineProcedures('users', {
  getUser: procedure()...,
});

// Pass them to serve()
const router = await serve(app, [userProcedures]);`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2006',
  },

  'VELOX-2007': {
    code: 'VELOX-2007',
    title: 'No Endpoints Enabled',
    description: 'serve() was called with both api and rpc disabled.',
    statusCode: 500,
    fix: {
      suggestion: 'Enable at least one endpoint type (api or rpc).',
      example: `// Enable REST API
await serve(app, procedures, { api: '/api', rpc: false });

// Or enable tRPC
await serve(app, procedures, { api: false, rpc: '/trpc' });

// Or enable both (default)
await serve(app, procedures);`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-2007',
  },

  // ==========================================================================
  // AUTH ERRORS (3XXX)
  // ==========================================================================

  'VELOX-3001': {
    code: 'VELOX-3001',
    title: 'Invalid JWT Secret',
    description: 'The JWT secret is missing, too short, or lacks sufficient entropy.',
    statusCode: 500,
    fix: {
      suggestion: 'Provide a strong secret with at least 64 characters and 16 unique characters.',
      example: `# Generate a secure secret
openssl rand -base64 64

# Set in environment
JWT_SECRET=<your-64-char-secret>
JWT_REFRESH_SECRET=<another-64-char-secret>`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3001',
  },

  'VELOX-3002': {
    code: 'VELOX-3002',
    title: 'Token Expired',
    description: 'The JWT access token has expired and cannot be used for authentication.',
    statusCode: 401,
    fix: {
      suggestion: 'Refresh the access token using your refresh token, or re-authenticate.',
      example: `// Client-side token refresh
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: storedRefreshToken }),
});
const { accessToken } = await response.json();`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3002',
  },

  'VELOX-3003': {
    code: 'VELOX-3003',
    title: 'Invalid Credentials',
    description: 'The provided email or password is incorrect.',
    statusCode: 401,
    fix: {
      suggestion: 'Verify the email and password are correct. Passwords are case-sensitive.',
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3003',
  },

  'VELOX-3004': {
    code: 'VELOX-3004',
    title: 'Rate Limit Exceeded',
    description: 'Too many authentication attempts. Please wait before trying again.',
    statusCode: 429,
    fix: {
      suggestion: 'Wait for the rate limit window to reset before retrying.',
      example: `// The response includes retry timing
// Retry-After: 900 (seconds until reset)

// Client should wait before retrying
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  await delay(parseInt(retryAfter) * 1000);
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3004',
  },

  'VELOX-3005': {
    code: 'VELOX-3005',
    title: 'Session Secret Invalid',
    description: 'The session secret is missing or has insufficient entropy.',
    statusCode: 500,
    fix: {
      suggestion: 'Provide a session secret with at least 32 characters and 16 unique characters.',
      example: `# Generate a secure session secret
openssl rand -base64 32

# Set in environment
SESSION_SECRET=<your-32-char-secret>`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3005',
  },

  'VELOX-3006': {
    code: 'VELOX-3006',
    title: 'CSRF Token Invalid',
    description: 'The CSRF token is missing, expired, or does not match.',
    statusCode: 403,
    fix: {
      suggestion: 'Include a valid CSRF token in your request.',
      example: `// Get CSRF token from cookie or meta tag
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

// Include in request headers
fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3006',
  },

  'VELOX-3007': {
    code: 'VELOX-3007',
    title: 'Token Revoked',
    description: 'This token has been revoked and can no longer be used.',
    statusCode: 401,
    fix: {
      suggestion: 'Re-authenticate to obtain new tokens.',
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-3007',
  },

  // ==========================================================================
  // ORM ERRORS (4XXX)
  // ==========================================================================

  'VELOX-4001': {
    code: 'VELOX-4001',
    title: 'Database Connection Failed',
    description: 'Could not establish a connection to the database.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify DATABASE_URL is correct and the database server is running.',
      example: `# Check your .env file
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# For SQLite
DATABASE_URL="file:./dev.db"

# Ensure database server is running
docker ps  # Check if database container is up`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-4001',
  },

  'VELOX-4002': {
    code: 'VELOX-4002',
    title: 'Database Already Connected',
    description: 'Attempted to connect to a database that is already connected.',
    statusCode: 500,
    fix: {
      suggestion:
        'The database client is already connected. Avoid calling connect() multiple times.',
      example: `// Connection is typically managed automatically
// Only call connect manually if needed
if (!isConnected) {
  await prisma.$connect();
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-4002',
  },

  'VELOX-4003': {
    code: 'VELOX-4003',
    title: 'Missing Database Plugin',
    description: 'Attempted to access ctx.db without registering the database plugin.',
    statusCode: 500,
    fix: {
      suggestion: 'Register the database plugin before accessing ctx.db.',
      example: `import { databasePlugin } from '@veloxts/velox';
import { prisma } from './database/index.js';

const app = await veloxApp({ port: 3000 });
await app.register(databasePlugin({ client: prisma }));

// Now ctx.db is available in procedures`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-4003',
  },

  // ==========================================================================
  // VALIDATION ERRORS (5XXX)
  // ==========================================================================

  'VELOX-5001': {
    code: 'VELOX-5001',
    title: 'Validation Failed',
    description: 'The request data failed schema validation.',
    statusCode: 400,
    fix: {
      suggestion: 'Check the fields property for specific validation errors.',
      example: `// Response includes field-specific errors
{
  "error": "ValidationError",
  "message": "Validation failed",
  "statusCode": 400,
  "code": "VELOX-5001",
  "fields": {
    "email": "Invalid email format",
    "age": "Must be at least 18"
  }
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-5001',
  },

  'VELOX-5002': {
    code: 'VELOX-5002',
    title: 'Invalid Schema Definition',
    description: 'The Zod schema definition is invalid.',
    statusCode: 500,
    fix: {
      suggestion: 'Check your Zod schema for syntax errors or invalid chaining.',
      example: `// Correct schema definition
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().min(0).max(150),
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-5002',
  },

  // ==========================================================================
  // CLIENT ERRORS (6XXX)
  // ==========================================================================

  'VELOX-6001': {
    code: 'VELOX-6001',
    title: 'Network Request Failed',
    description: 'The HTTP request could not be completed due to a network error.',
    statusCode: 0,
    fix: {
      suggestion: 'Check your internet connection and ensure the API server is reachable.',
      example: `// Handle network errors gracefully
try {
  const data = await api.users.list();
} catch (error) {
  if (isNetworkError(error)) {
    console.log('Network unavailable, using cached data');
    return getCachedData();
  }
  throw error;
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-6001',
  },

  'VELOX-6002': {
    code: 'VELOX-6002',
    title: 'API Base URL Not Configured',
    description: 'The VeloxTS client was created without a base URL.',
    statusCode: 500,
    fix: {
      suggestion: 'Provide a baseUrl when creating the client.',
      example: `import { createClient } from '@veloxts/client';

const api = createClient({
  baseUrl: process.env.API_URL || 'http://localhost:3000/api',
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-6002',
  },

  // ==========================================================================
  // CACHE ERRORS (7XXX)
  // ==========================================================================

  'VELOX-7001': {
    code: 'VELOX-7001',
    title: 'Cache Driver Not Found',
    description: 'The specified cache driver is not available or not installed.',
    statusCode: 500,
    fix: {
      suggestion: 'Install the required cache driver dependencies.',
      example: `# For Redis cache
pnpm add ioredis

# Configure the cache
app.register(cachePlugin({
  driver: 'redis',
  config: { url: process.env.REDIS_URL },
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-7001',
  },

  'VELOX-7002': {
    code: 'VELOX-7002',
    title: 'Redis Connection Failed',
    description: 'Could not establish a connection to the Redis server.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify REDIS_URL is correct and the Redis server is running.',
      example: `# Check your .env file
REDIS_URL="redis://localhost:6379"

# Or with authentication
REDIS_URL="redis://:password@localhost:6379"

# Start Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-7002',
  },

  'VELOX-7003': {
    code: 'VELOX-7003',
    title: 'Cache Key Too Long',
    description: 'The cache key exceeds the maximum allowed length.',
    statusCode: 400,
    fix: {
      suggestion: 'Use shorter cache keys or hash long keys.',
      example: `import { createHash } from 'crypto';

// Hash long keys
function cacheKey(data: string): string {
  if (data.length > 200) {
    return createHash('sha256').update(data).digest('hex');
  }
  return data;
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-7003',
  },

  // ==========================================================================
  // QUEUE ERRORS (8XXX)
  // ==========================================================================

  'VELOX-8001': {
    code: 'VELOX-8001',
    title: 'Queue Connection Failed',
    description: 'Could not connect to the queue backend (Redis/BullMQ).',
    statusCode: 503,
    fix: {
      suggestion: 'Verify Redis is running and REDIS_URL is configured.',
      example: `# Check your .env file
REDIS_URL="redis://localhost:6379"

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Configure queue
app.register(queuePlugin({
  driver: 'bullmq',
  config: { connection: { url: process.env.REDIS_URL } },
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-8001',
  },

  'VELOX-8002': {
    code: 'VELOX-8002',
    title: 'Job Handler Not Found',
    description: 'No handler is registered for the dispatched job type.',
    statusCode: 500,
    fix: {
      suggestion: 'Register the job handler before dispatching.',
      example: `// Define the job
export const sendEmail = defineJob({
  name: 'email.send',
  schema: z.object({ to: z.string().email() }),
  handler: async ({ data }) => {
    await mailer.send(data.to, 'Hello!');
  },
});

// Register with queue
queue.registerJob(sendEmail);

// Now you can dispatch
await dispatch(sendEmail, { to: 'user@example.com' });`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-8002',
  },

  'VELOX-8003': {
    code: 'VELOX-8003',
    title: 'Job Execution Failed',
    description: 'A job failed to execute after all retry attempts.',
    statusCode: 500,
    fix: {
      suggestion: 'Check the job logs for error details. Consider adding error handling.',
      example: `export const processOrder = defineJob({
  name: 'order.process',
  schema: OrderSchema,
  retries: 3,
  backoff: { type: 'exponential', delay: 1000 },
  handler: async ({ data }) => {
    try {
      await processOrderLogic(data);
    } catch (error) {
      // Log and rethrow for retry
      console.error('Order processing failed:', error);
      throw error;
    }
  },
});`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-8003',
  },

  // ==========================================================================
  // MAIL ERRORS (9XXX)
  // ==========================================================================

  'VELOX-9001': {
    code: 'VELOX-9001',
    title: 'SMTP Connection Failed',
    description: 'Could not connect to the SMTP mail server.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify your SMTP configuration and server availability.',
      example: `# Check your .env file
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-user"
SMTP_PASS="your-password"

# Configure mail
app.register(mailPlugin({
  driver: 'smtp',
  config: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-9001',
  },

  'VELOX-9002': {
    code: 'VELOX-9002',
    title: 'Mail Send Failed',
    description: 'The email could not be sent due to a delivery error.',
    statusCode: 500,
    fix: {
      suggestion: 'Check the recipient address, email content, and server logs.',
      example: `try {
  await mail.send({
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Welcome!</p>',
  });
} catch (error) {
  if (error.code === 'VELOX-9002') {
    // Log the original error for debugging
    console.error('Mail delivery failed:', error.cause);
  }
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-9002',
  },

  'VELOX-9003': {
    code: 'VELOX-9003',
    title: 'Invalid Email Address',
    description: 'One or more email addresses in the message are invalid.',
    statusCode: 400,
    fix: {
      suggestion: 'Validate email addresses before sending.',
      example: `import { z } from 'zod';

const emailSchema = z.string().email();

// Validate before sending
const result = emailSchema.safeParse(recipientEmail);
if (!result.success) {
  throw new Error('Invalid email address');
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-9003',
  },

  // ==========================================================================
  // STORAGE ERRORS (10XXX)
  // ==========================================================================

  'VELOX-10001': {
    code: 'VELOX-10001',
    title: 'Storage Driver Not Found',
    description: 'The specified storage driver is not available or not installed.',
    statusCode: 500,
    fix: {
      suggestion: 'Install the required storage driver dependencies.',
      example: `# For S3 storage
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# Configure storage
app.register(storagePlugin({
  driver: 's3',
  config: {
    bucket: 'my-bucket',
    region: 'us-east-1',
  },
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-10001',
  },

  'VELOX-10002': {
    code: 'VELOX-10002',
    title: 'File Not Found',
    description: 'The requested file does not exist in storage.',
    statusCode: 404,
    fix: {
      suggestion: 'Verify the file path is correct and the file has been uploaded.',
      example: `// Check if file exists before reading
if (await storage.exists('path/to/file.pdf')) {
  const content = await storage.get('path/to/file.pdf');
} else {
  console.log('File not found');
}`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-10002',
  },

  'VELOX-10003': {
    code: 'VELOX-10003',
    title: 'Storage Permission Denied',
    description: 'Access to the file or bucket was denied due to permissions.',
    statusCode: 403,
    fix: {
      suggestion: 'Check your storage credentials and bucket/directory permissions.',
      example: `# For S3, verify IAM permissions include:
# - s3:GetObject
# - s3:PutObject
# - s3:DeleteObject
# - s3:ListBucket

# For local storage, check directory permissions
chmod 755 ./storage`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-10003',
  },

  'VELOX-10004': {
    code: 'VELOX-10004',
    title: 'S3 Connection Failed',
    description: 'Could not connect to the S3-compatible storage service.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify your S3 credentials and endpoint configuration.',
      example: `# Check your .env file
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET="your-bucket"

# For S3-compatible services (R2, MinIO)
S3_ENDPOINT="https://your-endpoint.com"`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-10004',
  },

  // ==========================================================================
  // SCHEDULER ERRORS (11XXX)
  // ==========================================================================

  'VELOX-11001': {
    code: 'VELOX-11001',
    title: 'Task Already Registered',
    description: 'A scheduled task with the same name is already registered.',
    statusCode: 500,
    fix: {
      suggestion: 'Use unique names for each scheduled task.',
      example: `// Each task must have a unique name
const schedule = defineSchedule([
  task('cleanup-sessions', async () => { ... }).daily().build(),
  task('cleanup-tokens', async () => { ... }).daily().build(), // Different name
]);`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-11001',
  },

  'VELOX-11002': {
    code: 'VELOX-11002',
    title: 'Invalid Cron Expression',
    description: 'The provided cron expression is malformed or invalid.',
    statusCode: 400,
    fix: {
      suggestion: 'Use a valid cron expression or the fluent scheduling API.',
      example: `// Fluent API (recommended)
task('my-task', handler)
  .daily()
  .at('03:00')
  .build();

// Or valid cron expression
task('my-task', handler)
  .cron('0 3 * * *')  // Every day at 3:00 AM
  .build();

// Cron format: minute hour day-of-month month day-of-week`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-11002',
  },

  // ==========================================================================
  // EVENTS ERRORS (12XXX)
  // ==========================================================================

  'VELOX-12001': {
    code: 'VELOX-12001',
    title: 'WebSocket Connection Failed',
    description: 'Could not establish a WebSocket connection.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify the WebSocket endpoint is correct and the server is running.',
      example: `// Client-side connection
const socket = new WebSocket('ws://localhost:3000/ws');

socket.onopen = () => console.log('Connected');
socket.onerror = (error) => console.error('Connection failed:', error);

// Ensure server is configured
app.register(eventsPlugin({
  driver: 'ws',
  path: '/ws',
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-12001',
  },

  'VELOX-12002': {
    code: 'VELOX-12002',
    title: 'Channel Authorization Failed',
    description: 'The user is not authorized to subscribe to this channel.',
    statusCode: 403,
    fix: {
      suggestion: 'Implement channel authorization or use public channels.',
      example: `// Private channel authorization
app.register(eventsPlugin({
  driver: 'ws',
  authorize: async (channel, user) => {
    // Private channels start with 'private-'
    if (channel.startsWith('private-user.')) {
      const userId = channel.replace('private-user.', '');
      return user?.id === userId;
    }
    return true; // Public channels
  },
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-12002',
  },

  'VELOX-12003': {
    code: 'VELOX-12003',
    title: 'Redis Pub/Sub Failed',
    description: 'Could not publish or subscribe to Redis channels.',
    statusCode: 503,
    fix: {
      suggestion: 'Verify Redis is running and configured for the events plugin.',
      example: `# Check Redis connection
REDIS_URL="redis://localhost:6379"

# Configure events with Redis for horizontal scaling
app.register(eventsPlugin({
  driver: 'ws',
  redis: process.env.REDIS_URL,  // Enables pub/sub across instances
}));`,
    },
    docsUrl: 'https://veloxts.dev/errors/VELOX-12003',
  },
};

// ============================================================================
// Catalog Access Functions
// ============================================================================

/**
 * Get an error catalog entry by code
 *
 * @param code - The error code (e.g., 'VELOX-1001')
 * @returns The catalog entry or undefined if not found
 */
export function getErrorEntry(code: string): ErrorCatalogEntry | undefined {
  return ERROR_CATALOG[code];
}

/**
 * Get all error codes for a specific domain
 *
 * @param domain - The error domain (e.g., 'CORE', 'AUTH')
 * @returns Array of error codes in that domain
 */
export function getErrorsByDomain(domain: ErrorDomain): string[] {
  const prefix = `VELOX-${ERROR_DOMAINS[domain]}`;
  return Object.keys(ERROR_CATALOG).filter((code) => code.startsWith(prefix));
}

/**
 * Check if an error code exists in the catalog
 *
 * @param code - The error code to check
 * @returns true if the code exists
 */
export function isKnownErrorCode(code: string): boolean {
  return code in ERROR_CATALOG;
}

/**
 * Get the documentation URL for an error code
 *
 * @param code - The error code
 * @returns The documentation URL or undefined
 */
export function getDocsUrl(code: string): string | undefined {
  return ERROR_CATALOG[code]?.docsUrl;
}

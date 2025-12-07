/**
 * Error Catalog - Centralized error definitions with fix suggestions
 *
 * Error codes follow the pattern: VELOX-XYYY
 * - X: Domain (1=Core, 2=Router, 3=Auth, 4=ORM, 5=Validation, 6=Client)
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

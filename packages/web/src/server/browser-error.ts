/**
 * Browser Stub for @veloxts/web/server
 *
 * This file is loaded when @veloxts/web/server is imported in a browser context.
 * It exports stubs that throw errors when called, providing clear guidance.
 *
 * @module @veloxts/web/server (browser condition)
 */

const SERVER_ONLY_ERROR =
  '@veloxts/web/server cannot be used in client components.\n\n' +
  'This module contains server-only code that cannot run in the browser.\n\n' +
  'Solutions:\n' +
  '1. Use @veloxts/web/client for browser-safe exports (hooks, types)\n' +
  '2. Move server imports to files with "use server" directive\n' +
  '3. Import from @veloxts/web/types for type-only imports\n\n' +
  'See: https://veloxts.dev/docs/web/server-client-separation';

function createServerOnlyStub(name: string): never {
  throw new Error(`${name}: ${SERVER_ONLY_ERROR}`);
}

// ============================================================================
// Action Builder Stubs
// ============================================================================
export const action = {
  input: () => createServerOnlyStub('action.input'),
  output: () => createServerOnlyStub('action.output'),
  handler: () => createServerOnlyStub('action.handler'),
  fromProcedure: () => createServerOnlyStub('action.fromProcedure'),
  build: () => createServerOnlyStub('action.build'),
};

// ============================================================================
// Auth Bridge Stubs
// ============================================================================
export const authAction = {
  fromTokenProcedure: () => createServerOnlyStub('authAction.fromTokenProcedure'),
  fromLogoutProcedure: () => createServerOnlyStub('authAction.fromLogoutProcedure'),
  fromRefreshProcedure: () => createServerOnlyStub('authAction.fromRefreshProcedure'),
};

export function isTokenResponse(): never {
  return createServerOnlyStub('isTokenResponse');
}

// ============================================================================
// tRPC Bridge Stubs
// ============================================================================
export function createActions(): never {
  return createServerOnlyStub('createActions');
}

export function createTrpcBridge(): never {
  return createServerOnlyStub('createTrpcBridge');
}

export const trpcBridge = createTrpcBridge;

export function wrapProcedure(): never {
  return createServerOnlyStub('wrapProcedure');
}

export class TrpcBridgeError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'TrpcBridgeError';
  }
}

// ============================================================================
// Error Classification Stubs
// ============================================================================
export function classifyError(): never {
  return createServerOnlyStub('classifyError');
}

export function classifyPrismaError(): never {
  return createServerOnlyStub('classifyPrismaError');
}

export function createErrorClassifier(): never {
  return createServerOnlyStub('createErrorClassifier');
}

export function toActionError(): never {
  return createServerOnlyStub('toActionError');
}

export const DEFAULT_ERROR_PATTERNS: never[] = [];
export const PRISMA_ERROR_PATTERNS: never[] = [];

// ============================================================================
// FormData Parsing Stubs
// ============================================================================
export function formDataToObject(): never {
  return createServerOnlyStub('formDataToObject');
}

export function isFormData(): never {
  return createServerOnlyStub('isFormData');
}

export function parseFormDataToSchema(): never {
  return createServerOnlyStub('parseFormDataToSchema');
}

export function parseFormDataToSchemaAsync(): never {
  return createServerOnlyStub('parseFormDataToSchemaAsync');
}

// ============================================================================
// Action Handler Stubs
// ============================================================================
export function createAction(): never {
  return createServerOnlyStub('createAction');
}

export function createActionContext(): never {
  return createServerOnlyStub('createActionContext');
}

export function createActionRegistry(): never {
  return createServerOnlyStub('createActionRegistry');
}

export function createAuthenticatedContext(): never {
  return createServerOnlyStub('createAuthenticatedContext');
}

export function createFormAction(): never {
  return createServerOnlyStub('createFormAction');
}

export function error(): never {
  return createServerOnlyStub('error');
}

export function generateActionId(): never {
  return createServerOnlyStub('generateActionId');
}

export function getActionRegistry(): never {
  return createServerOnlyStub('getActionRegistry');
}

export function isAuthenticatedContext(): never {
  return createServerOnlyStub('isAuthenticatedContext');
}

export function isError(): never {
  return createServerOnlyStub('isError');
}

export function isSuccess(): never {
  return createServerOnlyStub('isSuccess');
}

export function parseCookies(): never {
  return createServerOnlyStub('parseCookies');
}

export function registerAction(): never {
  return createServerOnlyStub('registerAction');
}

export function resetActionRegistry(): never {
  return createServerOnlyStub('resetActionRegistry');
}

export function success(): never {
  return createServerOnlyStub('success');
}

export const ok = success;

// ============================================================================
// Procedure Bridge Stubs
// ============================================================================
export function createProcedureContext(): never {
  return createServerOnlyStub('createProcedureContext');
}

export function executeProcedureDirectly(): never {
  return createServerOnlyStub('executeProcedureDirectly');
}

// ============================================================================
// Validated Server Action Stubs
// ============================================================================
export function validated(): never {
  return createServerOnlyStub('validated');
}

export function validatedMutation(): never {
  return createServerOnlyStub('validatedMutation');
}

export function validatedQuery(): never {
  return createServerOnlyStub('validatedQuery');
}

export function clearRateLimitStore(): never {
  return createServerOnlyStub('clearRateLimitStore');
}

export function resetServerContextCache(): never {
  return createServerOnlyStub('resetServerContextCache');
}

export function stopRateLimitCleanup(): never {
  return createServerOnlyStub('stopRateLimitCleanup');
}

export class AuthenticationError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'AuthorizationError';
  }
}

export class CsrfError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'CsrfError';
  }
}

export class InputSizeError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'InputSizeError';
  }
}

export class RateLimitError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// Fastify Adapter Stubs
// ============================================================================
export function createApiHandler(): never {
  return createServerOnlyStub('createApiHandler');
}

export function createH3ApiHandler(): never {
  return createServerOnlyStub('createH3ApiHandler');
}

export function isFastifyInstance(): never {
  return createServerOnlyStub('isFastifyInstance');
}

// ============================================================================
// H3/Vinxi Adapter Stubs
// ============================================================================
export function createH3Action(): never {
  return createServerOnlyStub('createH3Action');
}

export function createH3AuthAdapter(): never {
  return createServerOnlyStub('createH3AuthAdapter');
}

export function createH3Context(): never {
  return createServerOnlyStub('createH3Context');
}

export function createMockAuthenticatedH3Context(): never {
  return createServerOnlyStub('createMockAuthenticatedH3Context');
}

export function createMockH3Context(): never {
  return createServerOnlyStub('createMockH3Context');
}

export function isAuthenticatedH3Context(): never {
  return createServerOnlyStub('isAuthenticatedH3Context');
}

export function isH3Context(): never {
  return createServerOnlyStub('isH3Context');
}

export function resetH3Utilities(): never {
  return createServerOnlyStub('resetH3Utilities');
}

export class H3AuthError extends Error {
  constructor() {
    super(SERVER_ONLY_ERROR);
    this.name = 'H3AuthError';
  }
}

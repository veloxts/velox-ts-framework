/**
 * @veloxts/web/server
 *
 * Server-only exports for VeloxTS server actions and adapters.
 * This module throws an error if imported in a client bundle.
 *
 * @example Server Action File
 * ```typescript
 * 'use server';
 *
 * import { authAction, validated } from '@veloxts/web/server';
 * import { loginSchema } from '@/api/schemas';
 *
 * export const login = authAction.fromTokenProcedure(
 *   authProcedures.procedures.createSession,
 *   { parseFormData: true, contextExtensions: { db } }
 * );
 *
 * export const getUsers = validated({
 *   schema: userQuerySchema,
 *   handler: async (input, ctx) => {
 *     return db.user.findMany();
 *   },
 * });
 * ```
 *
 * @module @veloxts/web/server
 */

// This will throw at runtime if imported in client bundle
import 'server-only';

// ============================================================================
// Action Builder - Recommended API
// ============================================================================
export type {
  Action,
  ActionBuilder as FluentActionBuilder,
  ActionConfig,
  ActionHandlerFn,
  ErrorHandler,
  FromProcedureOptions,
  ValidatedAction,
} from '../actions/action.js';
export { action } from '../actions/action.js';
// ============================================================================
// Auth Bridge - Token-based authentication helpers
// ============================================================================
export type {
  AuthActionOptions,
  AuthCookieConfig,
  H3ActionContextWithRefreshToken,
  LoginResponse,
  TokenResponse,
} from '../actions/auth-bridge.js';
export { authAction, isTokenResponse } from '../actions/auth-bridge.js';
// ============================================================================
// tRPC Bridge
// ============================================================================
export type {
  ExtractProcedureInput,
  ExtractProcedureOutput,
  ExtractProcedurePaths,
  TrpcActionOptions,
  TrpcBridge,
  TrpcCaller,
} from '../actions/bridge.js';
export {
  createActions,
  createTrpcBridge,
  TrpcBridgeError,
  trpcBridge,
  wrapProcedure,
} from '../actions/bridge.js';
// ============================================================================
// Error Classification
// ============================================================================
export type {
  ClassificationResult,
  ClassifyErrorOptions,
  ErrorPattern,
} from '../actions/error-classifier.js';
export {
  classifyError,
  classifyPrismaError,
  createErrorClassifier,
  DEFAULT_ERROR_PATTERNS,
  PRISMA_ERROR_PATTERNS,
  toActionError,
} from '../actions/error-classifier.js';
// ============================================================================
// FormData Parsing
// ============================================================================
export type { FormParseOptions } from '../actions/form-parser.js';
export {
  formDataToObject,
  isFormData,
  parseFormDataToSchema,
  parseFormDataToSchemaAsync,
} from '../actions/form-parser.js';
// ============================================================================
// Result Helpers
// ============================================================================
// ============================================================================
// Action Handler Utilities
// ============================================================================
export {
  createAction,
  createActionContext,
  createActionRegistry,
  createAuthenticatedContext,
  createFormAction,
  error,
  generateActionId,
  getActionRegistry,
  isAuthenticatedContext,
  isError,
  isSuccess,
  parseCookies,
  registerAction,
  resetActionRegistry,
  success,
  success as ok,
} from '../actions/handler.js';
// ============================================================================
// Procedure Bridge - Direct procedure execution
// ============================================================================
export type {
  ExecuteProcedureOptions,
  InferProcedureInputType,
  InferProcedureOutputType,
} from '../actions/procedure-bridge.js';
export {
  createProcedureContext,
  executeProcedureDirectly,
} from '../actions/procedure-bridge.js';
// ============================================================================
// Server-Only Types (re-exported for convenience)
// ============================================================================
export type {
  ActionBuilder,
  ActionContext,
  ActionHandler,
  ActionMetadata,
  ActionRegistry,
  AuthenticatedActionContext,
  CallableAction,
  CallableFormAction,
  CreateActionOptions,
  FormActionHandler,
  ProcedureCaller,
  RegisteredAction,
  TrpcBridgeOptions,
} from '../actions/types.js';
// ============================================================================
// Validated Server Actions - For 'use server' directives
// ============================================================================
export type {
  InferSchemaType,
  InferValidatedInput,
  InferValidatedOutput,
  RateLimitConfig,
  ValidatedHandler,
  ValidatedOptions,
  ValidatedOptionsAuthenticated,
  ValidatedOptionsBase,
  ValidZodSchema,
} from '../actions/validated.js';
export {
  AuthenticationError,
  AuthorizationError,
  CsrfError,
  clearRateLimitStore,
  InputSizeError,
  RateLimitError,
  resetServerContextCache,
  stopRateLimitCleanup,
  validated,
  validatedMutation,
  validatedQuery,
} from '../actions/validated.js';
// ============================================================================
// Fastify Adapter - For embedding Fastify in Vinxi
// ============================================================================
export {
  createApiHandler,
  createH3ApiHandler,
  isFastifyInstance,
} from '../adapters/fastify-adapter.js';
// ============================================================================
// H3/Vinxi Adapter - For RSC server actions
// ============================================================================
export type {
  AuthenticatedH3ActionContext,
  H3ActionContext,
  H3AdapterConfig,
  H3AuthAdapter,
  H3CookieOptions,
} from '../adapters/h3-adapter.js';
export {
  createH3Action,
  createH3AuthAdapter,
  createH3Context,
  createMockAuthenticatedH3Context,
  createMockH3Context,
  H3AuthError,
  isAuthenticatedH3Context,
  isH3Context,
  resetH3Utilities,
} from '../adapters/h3-adapter.js';
// ============================================================================
// Browser-Safe Types (also available in @veloxts/web/types)
// ============================================================================
export type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  ActionSuccess,
} from '../types/actions.js';

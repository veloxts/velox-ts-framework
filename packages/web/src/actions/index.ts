/**
 * Server Actions Module
 *
 * Type-safe server actions with tRPC bridge support for VeloxTS.
 *
 * @module @veloxts/web/actions
 */

export type {
  Action,
  ActionBuilder as FluentActionBuilder,
  ActionConfig,
  ActionHandlerFn,
  ErrorHandler,
  FromProcedureOptions,
  ValidatedAction,
} from './action.js';
// New action() helper - recommended API
export { action } from './action.js';
export type {
  ExtractProcedureInput,
  ExtractProcedureOutput,
  ExtractProcedurePaths,
  TrpcActionOptions,
  TrpcBridge,
  TrpcCaller,
} from './bridge.js';
// Bridge functions
export {
  createActions,
  createTrpcBridge,
  TrpcBridgeError,
  trpcBridge, // Short alias for createTrpcBridge
  wrapProcedure,
} from './bridge.js';
// Error classification
export type {
  ClassificationResult,
  ClassifyErrorOptions,
  ErrorPattern,
} from './error-classifier.js';
export {
  classifyError,
  classifyPrismaError,
  createErrorClassifier,
  DEFAULT_ERROR_PATTERNS,
  PRISMA_ERROR_PATTERNS,
  toActionError,
} from './error-classifier.js';
// FormData parsing
export type { FormParseOptions } from './form-parser.js';
export {
  formDataToObject,
  isFormData,
  parseFormDataToSchema,
  parseFormDataToSchemaAsync,
} from './form-parser.js';
// Handler functions
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
} from './handler.js';
// Procedure bridge - direct procedure execution
export type { ExecuteProcedureOptions } from './procedure-bridge.js';
export {
  createProcedureContext,
  executeProcedureDirectly,
  type InferProcedureInputType,
  type InferProcedureOutputType,
} from './procedure-bridge.js';
// Auth bridge - authentication-specific action helpers
export type {
  AuthActionOptions,
  AuthCookieConfig,
  H3ActionContextWithRefreshToken,
  LoginResponse,
  TokenResponse,
} from './auth-bridge.js';
export { authAction, isTokenResponse } from './auth-bridge.js';
// Types
export type {
  ActionBuilder,
  ActionContext,
  ActionError,
  ActionErrorCode,
  ActionHandler,
  ActionMetadata,
  ActionRegistry,
  ActionResult,
  ActionSuccess,
  AuthenticatedActionContext,
  CallableAction,
  CallableFormAction,
  CreateActionOptions,
  FormActionHandler,
  ProcedureCaller,
  RegisteredAction,
  TrpcBridgeOptions,
} from './types.js';
// Validated server action helper (for "use server" directive)
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
} from './validated.js';
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
} from './validated.js';

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
} from './handler.js';
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

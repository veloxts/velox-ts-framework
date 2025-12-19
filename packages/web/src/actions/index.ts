/**
 * Server Actions Module
 *
 * Type-safe server actions with tRPC bridge support for VeloxTS.
 *
 * @module @veloxts/web/actions
 */

export type { TrpcActionOptions, TrpcBridge, TrpcCaller } from './bridge.js';
// Bridge functions
export {
  createActions,
  createTrpcBridge,
  TrpcBridgeError,
  wrapProcedure,
} from './bridge.js';
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

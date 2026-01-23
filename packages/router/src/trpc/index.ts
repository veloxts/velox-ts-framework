/**
 * tRPC adapter exports
 *
 * @module trpc
 */

export type {
  AnyRouter,
  /** @deprecated Use `TRPCRouter` instead */
  AsTRPCRouter,
  // Type inference utilities for router types
  CollectionsToRouterRecord,
  ExtractNamespace,
  ExtractProcedures,
  InferAppRouter,
  InferRouterFromCollections,
  MapProcedureRecordToTRPC,
  MapProcedureToTRPC,
  TRPCInstance,
  TRPCPluginOptions,
  // @trpc/react-query compatibility
  TRPCRouter,
} from './adapter.js';
export {
  appRouter,
  buildTRPCRouter,
  createTRPCContextFactory,
  isVeloxTRPCError,
  registerTRPCPlugin,
  trpc,
  veloxErrorToTRPCError,
} from './adapter.js';

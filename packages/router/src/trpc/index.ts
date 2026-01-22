/**
 * tRPC adapter exports
 *
 * @module trpc
 */

export type {
  AnyRouter,
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

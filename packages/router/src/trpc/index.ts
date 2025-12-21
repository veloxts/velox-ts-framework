/**
 * tRPC adapter exports
 *
 * @module trpc
 */

export type { AnyRouter, InferAppRouter, TRPCInstance, TRPCPluginOptions } from './adapter.js';
export {
  appRouter,
  buildTRPCRouter,
  createAppRouter,
  createTRPC,
  createTRPCContextFactory,
  isVeloxTRPCError,
  registerTRPCPlugin,
  trpc,
  veloxErrorToTRPCError,
} from './adapter.js';

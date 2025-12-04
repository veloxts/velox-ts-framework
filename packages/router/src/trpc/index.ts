/**
 * tRPC adapter exports
 *
 * @module trpc
 */

export type { AnyRouter, InferAppRouter, TRPCInstance, TRPCPluginOptions } from './adapter.js';
export {
  buildTRPCRouter,
  createAppRouter,
  createTRPC,
  createTRPCContextFactory,
  isVeloxTRPCError,
  registerTRPCPlugin,
  veloxErrorToTRPCError,
} from './adapter.js';

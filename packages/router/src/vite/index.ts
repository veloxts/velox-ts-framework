/**
 * Vite Plugin for VeloxTS Router
 *
 * Provides browser-compatible stubs for Node.js built-in modules.
 * This is necessary because Vite scans the entire import graph during
 * development and production builds, including type-only imports that
 * lead to @veloxts packages using Node.js modules.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { veloxNodeStubs } from '@veloxts/router/vite';
 *
 * export default defineConfig({
 *   plugins: [veloxNodeStubs(), react()],
 * });
 * ```
 *
 * @module @veloxts/router/vite
 */

import type { Plugin as EsbuildPlugin } from 'esbuild';
import type { Plugin, UserConfig } from 'vite';

// ============================================================================
// Stub Definitions
// ============================================================================

/**
 * Stub implementations for Node.js built-ins and problematic npm packages.
 * These are minimal stubs that satisfy module resolution.
 * They never execute in the browser - they only exist to satisfy Vite's bundle analysis.
 */
const NODE_STUBS: Record<string, string> = {
  // =========================================================================
  // NPM packages that should never be bundled for browser
  // These packages use Node.js APIs and must be replaced with no-ops
  // =========================================================================
  dotenv: `
    export const config = () => ({ parsed: {} });
    export const configDotenv = () => ({ parsed: {} });
    export const parse = () => ({});
    export const populate = () => {};
    export default { config, configDotenv, parse, populate };
  `,
  'dotenv/config': `
    // Side-effect import stub - does nothing in browser
    export {};
  `,

  // =========================================================================
  // CommonJS packages that need ESM stubs
  // These are server-only packages pulled in via typeof import() chains
  // =========================================================================
  'fastify-plugin': `
    const fp = (fn, opts) => {
      if (typeof fn !== 'function') return fn;
      fn[Symbol.for('skip-override')] = opts?.encapsulate !== false;
      fn[Symbol.for('fastify.display-name')] = opts?.name;
      return fn;
    };
    fp.default = fp;
    export default fp;
    export { fp };
  `,
  fastify: `
    class Fastify {
      constructor() {}
      register() { return this; }
      use() { return this; }
      get() { return this; }
      post() { return this; }
      put() { return this; }
      delete() { return this; }
      patch() { return this; }
      listen() { return Promise.resolve(); }
      ready() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      addHook() { return this; }
      decorate() { return this; }
      decorateRequest() { return this; }
      decorateReply() { return this; }
    }
    const fastify = (opts) => new Fastify();
    fastify.default = fastify;
    fastify.fastify = fastify;
    export default fastify;
    export { fastify };
  `,
  '@fastify/cookie': `
    const plugin = (fastify, opts, done) => { if (done) done(); };
    plugin[Symbol.for('skip-override')] = true;
    export default plugin;
  `,
  '@fastify/cors': `
    const plugin = (fastify, opts, done) => { if (done) done(); };
    plugin[Symbol.for('skip-override')] = true;
    export default plugin;
  `,
  '@fastify/formbody': `
    const plugin = (fastify, opts, done) => { if (done) done(); };
    plugin[Symbol.for('skip-override')] = true;
    export default plugin;
  `,
  '@fastify/static': `
    const plugin = (fastify, opts, done) => { if (done) done(); };
    plugin[Symbol.for('skip-override')] = true;
    export default plugin;
  `,
  pino: `
    const pino = () => ({
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      child: () => pino(),
    });
    pino.default = pino;
    export default pino;
    export { pino };
  `,

  // =========================================================================
  // Node.js built-in modules (prefixed versions: node:*)
  // =========================================================================
  'node:util': `
    export const promisify = (fn) => fn;
    export const deprecate = (fn) => fn;
    export const inspect = () => '';
    export const format = (...args) => args.join(' ');
    export const inherits = () => {};
    export const isDeepStrictEqual = () => false;
    export default { promisify, deprecate, inspect, format, inherits, isDeepStrictEqual };
  `,
  'node:crypto': `
    export const randomBytes = (size) => new Uint8Array(size || 0);
    export const scrypt = (password, salt, keylen, options, callback) => {
      if (typeof options === 'function') callback = options;
      if (callback) callback(null, new Uint8Array(keylen));
    };
    export const timingSafeEqual = () => true;
    export const createHmac = () => ({ update: () => ({ digest: () => "" }) });
    export const createHash = () => ({ update: () => ({ digest: () => "" }) });
    export const randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    export default { randomBytes, scrypt, timingSafeEqual, createHmac, createHash, randomUUID };
  `,
  'node:module': `
    export const createRequire = () => () => ({});
    export const builtinModules = [];
    export default { createRequire, builtinModules };
  `,
  'node:fs': `
    export const readFileSync = () => "";
    export const writeFileSync = () => {};
    export const existsSync = () => false;
    export const mkdirSync = () => {};
    export const readdirSync = () => [];
    export const statSync = () => ({ isFile: () => false, isDirectory: () => false });
    export const promises = {
      readFile: async () => "",
      writeFile: async () => {},
      mkdir: async () => {},
      readdir: async () => [],
      stat: async () => ({ isFile: () => false, isDirectory: () => false }),
    };
    export default { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, promises };
  `,
  'node:path': `
    export const join = (...args) => args.filter(Boolean).join("/").replace(/\\/+/g, "/");
    export const resolve = (...args) => args.filter(Boolean).join("/").replace(/\\/+/g, "/");
    export const dirname = (p) => p ? p.split("/").slice(0, -1).join("/") || "/" : ".";
    export const basename = (p, ext) => { const base = p ? p.split("/").pop() || "" : ""; return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base; };
    export const extname = (p) => { const base = p ? p.split("/").pop() || "" : ""; const idx = base.lastIndexOf("."); return idx > 0 ? base.slice(idx) : ""; };
    export const parse = (p) => ({ root: "", dir: dirname(p), base: basename(p), ext: extname(p), name: basename(p, extname(p)) });
    export const relative = (from, to) => to;
    export const isAbsolute = (p) => p ? p.startsWith("/") : false;
    export const normalize = (p) => p;
    export const sep = "/";
    export const delimiter = ":";
    export default { join, resolve, dirname, basename, extname, parse, relative, isAbsolute, normalize, sep, delimiter };
  `,
  'node:url': `
    export const fileURLToPath = (u) => typeof u === 'string' ? u.replace('file://', '') : u.pathname || '';
    export const pathToFileURL = (p) => new URL("file://" + p);
    export const URL = globalThis.URL;
    export const URLSearchParams = globalThis.URLSearchParams;
    export default { fileURLToPath, pathToFileURL, URL, URLSearchParams };
  `,
  'node:os': `
    export const homedir = () => "/";
    export const tmpdir = () => "/tmp";
    export const platform = () => "browser";
    export const hostname = () => "localhost";
    export const type = () => "Browser";
    export const arch = () => "wasm";
    export const cpus = () => [];
    export const EOL = "\\n";
    export default { homedir, tmpdir, platform, hostname, type, arch, cpus, EOL };
  `,
  'node:buffer': `
    const BufferImpl = {
      from: (data) => new Uint8Array(typeof data === 'string' ? new TextEncoder().encode(data) : data || 0),
      alloc: (size) => new Uint8Array(size),
      allocUnsafe: (size) => new Uint8Array(size),
      isBuffer: (obj) => obj instanceof Uint8Array,
      concat: (list) => { const total = list.reduce((acc, buf) => acc + buf.length, 0); const result = new Uint8Array(total); let offset = 0; for (const buf of list) { result.set(buf, offset); offset += buf.length; } return result; },
      byteLength: (str) => new TextEncoder().encode(str).length,
    };
    export const Buffer = BufferImpl;
    export default { Buffer: BufferImpl };
  `,
  'node:events': `
    export class EventEmitter {
      constructor() { this._events = {}; }
      on(event, listener) { (this._events[event] = this._events[event] || []).push(listener); return this; }
      off(event, listener) { const arr = this._events[event]; if (arr) { const idx = arr.indexOf(listener); if (idx >= 0) arr.splice(idx, 1); } return this; }
      emit(event, ...args) { const arr = this._events[event]; if (arr) arr.forEach(fn => fn(...args)); return !!arr; }
      once(event, listener) { const wrapped = (...args) => { this.off(event, wrapped); listener(...args); }; return this.on(event, wrapped); }
      addListener(event, listener) { return this.on(event, listener); }
      removeListener(event, listener) { return this.off(event, listener); }
      removeAllListeners(event) { if (event) delete this._events[event]; else this._events = {}; return this; }
      listeners(event) { return this._events[event] || []; }
      listenerCount(event) { return (this._events[event] || []).length; }
    }
    export default EventEmitter;
  `,
  'node:stream': `
    export class Readable { pipe() { return this; } on() { return this; } }
    export class Writable { write() { return true; } end() {} on() { return this; } }
    export class Transform extends Writable { pipe() { return this; } }
    export class Duplex extends Writable { pipe() { return this; } }
    export class PassThrough extends Transform {}
    export const pipeline = (...args) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(null); };
    export const finished = (stream, cb) => { if (typeof cb === 'function') cb(null); };
    export default { Readable, Writable, Transform, Duplex, PassThrough, pipeline, finished };
  `,
  'node:http': `
    export const createServer = () => ({ listen: () => {}, close: () => {}, on: () => {} });
    export const request = () => ({ on: () => {}, write: () => {}, end: () => {} });
    export const get = () => ({ on: () => {} });
    export class Agent {}
    export const STATUS_CODES = { 200: 'OK', 404: 'Not Found', 500: 'Internal Server Error' };
    export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    export default { createServer, request, get, Agent, STATUS_CODES, METHODS };
  `,
  'node:https': `
    export const createServer = () => ({ listen: () => {}, close: () => {}, on: () => {} });
    export const request = () => ({ on: () => {}, write: () => {}, end: () => {} });
    export const get = () => ({ on: () => {} });
    export class Agent {}
    export default { createServer, request, get, Agent };
  `,
  'node:net': `
    export const createServer = () => ({ listen: () => {}, close: () => {}, on: () => {} });
    export const createConnection = () => ({ on: () => {}, write: () => {}, end: () => {} });
    export const connect = createConnection;
    export class Socket { on() { return this; } write() { return true; } end() {} destroy() {} }
    export const isIP = () => 0;
    export const isIPv4 = () => false;
    export const isIPv6 = () => false;
    export default { createServer, createConnection, connect, Socket, isIP, isIPv4, isIPv6 };
  `,
  'node:async_hooks': `
    export const createHook = () => ({ enable: () => {}, disable: () => {} });
    export const executionAsyncId = () => 0;
    export const triggerAsyncId = () => 0;
    export class AsyncResource { runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); } }
    export class AsyncLocalStorage { getStore() { return undefined; } run(store, fn, ...args) { return fn(...args); } enterWith() {} disable() {} }
    export default { createHook, executionAsyncId, triggerAsyncId, AsyncResource, AsyncLocalStorage };
  `,
  'node:assert': `
    const assert = (value, message) => { if (!value) throw new Error(message || 'Assertion failed'); };
    assert.ok = assert;
    assert.equal = (a, b, msg) => { if (a != b) throw new Error(msg || 'Not equal'); };
    assert.strictEqual = (a, b, msg) => { if (a !== b) throw new Error(msg || 'Not strictly equal'); };
    assert.deepEqual = () => {};
    assert.deepStrictEqual = () => {};
    assert.notEqual = (a, b, msg) => { if (a == b) throw new Error(msg || 'Equal'); };
    assert.notStrictEqual = (a, b, msg) => { if (a === b) throw new Error(msg || 'Strictly equal'); };
    assert.throws = (fn, expected, msg) => { try { fn(); throw new Error(msg || 'Did not throw'); } catch {} };
    assert.doesNotThrow = (fn) => { fn(); };
    assert.fail = (msg) => { throw new Error(msg || 'Failed'); };
    export default assert;
    export { assert };
  `,
  'node:diagnostics_channel': `
    export const channel = (name) => ({ name, subscribe: () => {}, unsubscribe: () => {}, publish: () => {}, hasSubscribers: false });
    export const hasSubscribers = () => false;
    export const subscribe = () => {};
    export const unsubscribe = () => {};
    export class Channel { constructor(name) { this.name = name; } subscribe() {} unsubscribe() {} publish() {} hasSubscribers = false; }
    export default { channel, hasSubscribers, subscribe, unsubscribe, Channel };
  `,
  'node:http2': `
    export const createServer = () => ({ listen: () => {}, close: () => {}, on: () => {} });
    export const createSecureServer = () => ({ listen: () => {}, close: () => {}, on: () => {} });
    export const connect = () => ({ on: () => {}, request: () => ({ on: () => {} }) });
    export const constants = {};
    export default { createServer, createSecureServer, connect, constants };
  `,
  'node:dns': `
    export const lookup = (hostname, opts, cb) => { if (typeof opts === 'function') cb = opts; if (cb) cb(null, '127.0.0.1', 4); };
    export const resolve = (hostname, rrtype, cb) => { if (typeof rrtype === 'function') cb = rrtype; if (cb) cb(null, []); };
    export const promises = { lookup: async () => ({ address: '127.0.0.1', family: 4 }), resolve: async () => [] };
    export default { lookup, resolve, promises };
  `,
  'node:string_decoder': `
    export class StringDecoder {
      constructor(encoding) { this.encoding = encoding || 'utf8'; }
      write(buffer) { return new TextDecoder(this.encoding).decode(buffer); }
      end(buffer) { return buffer ? this.write(buffer) : ''; }
    }
    export default { StringDecoder };
  `,
  'node:zlib': `
    export const gzip = (buf, cb) => { if (cb) cb(null, buf); };
    export const gunzip = (buf, cb) => { if (cb) cb(null, buf); };
    export const deflate = (buf, cb) => { if (cb) cb(null, buf); };
    export const inflate = (buf, cb) => { if (cb) cb(null, buf); };
    export const createGzip = () => ({ on: () => {}, write: () => {}, end: () => {} });
    export const createGunzip = () => ({ on: () => {}, write: () => {}, end: () => {} });
    export default { gzip, gunzip, deflate, inflate, createGzip, createGunzip };
  `,
  'node:querystring': `
    export const parse = (str) => Object.fromEntries(new URLSearchParams(str));
    export const stringify = (obj) => new URLSearchParams(obj).toString();
    export const encode = stringify;
    export const decode = parse;
    export default { parse, stringify, encode, decode };
  `,
  'node:child_process': `
    export const spawn = () => ({ on: () => {}, stdout: { on: () => {} }, stderr: { on: () => {} }, kill: () => {} });
    export const exec = (cmd, opts, cb) => { if (typeof opts === 'function') cb = opts; if (cb) cb(new Error('Not supported in browser')); };
    export const execSync = () => { throw new Error('Not supported in browser'); };
    export const fork = () => ({ on: () => {}, send: () => {} });
    export default { spawn, exec, execSync, fork };
  `,
  'node:worker_threads': `
    export const isMainThread = true;
    export const parentPort = null;
    export const workerData = null;
    export class Worker { constructor() { throw new Error('Workers not supported in browser stub'); } }
    export class MessageChannel { constructor() { this.port1 = {}; this.port2 = {}; } }
    export default { isMainThread, parentPort, workerData, Worker, MessageChannel };
  `,
  'node:tty': `
    export const isatty = () => false;
    export class ReadStream {}
    export class WriteStream { get isTTY() { return false; } }
    export default { isatty, ReadStream, WriteStream };
  `,
  'node:readline': `
    export const createInterface = () => ({ on: () => {}, close: () => {}, question: (q, cb) => cb('') });
    export default { createInterface };
  `,
  'node:perf_hooks': `
    export const performance = globalThis.performance || { now: () => Date.now() };
    export class PerformanceObserver { observe() {} disconnect() {} }
    export default { performance, PerformanceObserver };
  `,
  'node:process': `
    const proc = {
      env: {},
      cwd: () => '/',
      chdir: () => {},
      exit: () => {},
      pid: 1,
      platform: 'browser',
      version: 'v0.0.0',
      versions: {},
      argv: [],
      execPath: '',
      on: () => proc,
      off: () => proc,
      emit: () => false,
      nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
      stdout: { write: () => true, isTTY: false },
      stderr: { write: () => true, isTTY: false },
      stdin: { on: () => {}, isTTY: false },
    };
    export default proc;
    export const env = proc.env;
    export const cwd = proc.cwd;
    export const platform = proc.platform;
    export const argv = proc.argv;
    export const exit = proc.exit;
    export const nextTick = proc.nextTick;
  `,
};

/**
 * Get all stubs including non-prefixed versions (e.g., 'util' in addition to 'node:util')
 */
function getAllStubs(): Record<string, string> {
  const nonPrefixedStubs: Record<string, string> = {};
  for (const key of Object.keys(NODE_STUBS)) {
    if (key.startsWith('node:')) {
      nonPrefixedStubs[key.replace('node:', '')] = NODE_STUBS[key];
    }
  }
  return { ...NODE_STUBS, ...nonPrefixedStubs };
}

// ============================================================================
// esbuild Plugin for Pre-bundling
// ============================================================================

/**
 * Creates an esbuild plugin configuration object for Vite's optimizeDeps.
 * This is used during Vite's pre-bundling phase to stub Node.js built-ins.
 */
function createEsbuildNodeStubsPlugin(): EsbuildPlugin {
  const allStubs = getAllStubs();

  return {
    name: 'velox-esbuild-node-stubs',
    setup(build) {
      // Match all Node.js built-in module patterns
      const nodeBuiltinFilter =
        /^(node:)?(util|crypto|module|fs|path|url|os|buffer|events|stream|http|https|net|async_hooks|assert|diagnostics_channel|http2|dns|string_decoder|zlib|querystring|child_process|worker_threads|tty|readline|perf_hooks|process)$/;

      build.onResolve({ filter: nodeBuiltinFilter }, (args) => {
        const moduleName = args.path.startsWith('node:') ? args.path : `node:${args.path}`;
        if (moduleName in allStubs || args.path in allStubs) {
          return {
            path: args.path,
            namespace: 'velox-node-stubs',
          };
        }
        return null;
      });

      // Also handle dotenv
      build.onResolve({ filter: /^dotenv(\/config)?$/ }, (args) => {
        return {
          path: args.path,
          namespace: 'velox-node-stubs',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'velox-node-stubs' }, (args) => {
        // Try with node: prefix first, then without
        const content =
          allStubs[args.path] ?? allStubs[`node:${args.path}`] ?? 'export default {};';
        return {
          contents: content,
          loader: 'js',
        };
      });
    },
  };
}

// ============================================================================
// Main Vite Plugin
// ============================================================================

/**
 * Vite plugin that stubs Node.js built-in modules for browser builds.
 *
 * When the frontend imports types from the API (e.g., AppRouter), Vite follows
 * the import chain and encounters Node.js modules from @veloxts/* packages.
 * This plugin provides empty stubs so the build completes.
 *
 * **How it works:**
 *
 * 1. **Pre-bundling phase (esbuild):** Configures `optimizeDeps.esbuildOptions.plugins`
 *    to intercept Node.js imports during dependency optimization.
 *
 * 2. **Application code (Vite/Rollup):** Uses `resolveId` and `load` hooks to
 *    provide virtual modules for any Node.js imports in application code.
 *
 * 3. **Safety net:** Excludes `@veloxts/*` packages from pre-bundling to ensure
 *    our plugin hooks can intercept all Node.js imports.
 *
 * **Important:** These stubs never execute in the browser - they only exist to
 * satisfy Vite/Rollup's bundle analysis. The actual code paths using these
 * modules are server-only.
 *
 * @returns Vite plugin configuration
 *
 * @example
 * ```typescript
 * import { veloxNodeStubs } from '@veloxts/router/vite';
 * import react from '@vitejs/plugin-react';
 * import { defineConfig } from 'vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     veloxNodeStubs(), // Must be first
 *     react(),
 *   ],
 * });
 * ```
 */
export function veloxNodeStubs(): Plugin {
  const allStubs = getAllStubs();

  return {
    name: 'velox-node-stubs',
    enforce: 'pre',

    config(config, { command }): UserConfig {
      // Only apply browser stubs for client builds, not SSR
      const isSsr = config.build?.ssr === true;
      if (isSsr) {
        return {};
      }

      // Build the resolve.alias configuration
      // This ensures Node.js builtins are replaced with our stubs BEFORE
      // Vite's externalization logic kicks in
      const aliasEntries: Record<string, string> = {};
      for (const moduleName of Object.keys(allStubs)) {
        aliasEntries[moduleName] = `\0velox-virtual:${moduleName}`;
      }

      return {
        // Define process.env for browser - Vite handles most cases but we ensure it exists
        define: {
          'process.env': '{}',
        },

        // Use resolve.alias to intercept Node.js builtins BEFORE externalization
        // This is more reliable than resolveId for pre-bundled dependencies
        resolve: {
          alias: aliasEntries,
        },

        // Configure dependency optimization (pre-bundling)
        optimizeDeps: {
          // Exclude @veloxts/* packages from pre-bundling so our plugin can
          // intercept their Node.js imports. This is a safety net.
          exclude: [
            '@veloxts/velox',
            '@veloxts/auth',
            '@veloxts/router',
            '@veloxts/core',
            '@veloxts/orm',
            '@veloxts/validation',
            '@veloxts/client',
          ],

          // Add esbuild plugin for any dependencies that DO get pre-bundled
          // This handles transitive dependencies that might import Node.js modules
          esbuildOptions: {
            plugins: [createEsbuildNodeStubsPlugin()],
          },
        },

        // Configure SSR settings to prevent Node.js module issues
        // When not in SSR mode, ensure Node.js builtins are not externalized
        ssr: {
          // In browser builds, we want to bundle (and stub) these modules
          // rather than externalizing them
          noExternal: command === 'build' ? [] : undefined,
        },
      };
    },

    resolveId(id) {
      // Handle virtual module resolution
      // Also intercept direct Node.js builtin imports as a fallback
      if (id in allStubs) {
        return `\0velox-virtual:${id}`;
      }
      // Handle the virtual module prefix from resolve.alias
      if (id.startsWith('\0velox-virtual:')) {
        return id;
      }
      return null;
    },

    load(id) {
      if (id.startsWith('\0velox-virtual:')) {
        const moduleName = id.replace('\0velox-virtual:', '');
        return allStubs[moduleName] ?? 'export default {};';
      }
      return null;
    },
  };
}

// Re-export for convenience
export { veloxNodeStubs as nodeStubs };

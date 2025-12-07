/**
 * Type tests for @veloxts/auth
 *
 * These tests verify that TypeScript type inference works correctly
 * for guards, policies, JWT, and other auth components.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { expectAssignable, expectType } from 'tsd';

// Import from the compiled dist folder directly
import type {
  AuthConfig,
  AuthContext,
  AuthMiddlewareOptions,
  GuardDefinition,
  GuardFunction,
  HashConfig,
  JwtConfig,
  PolicyAction,
  PolicyDefinition,
  TokenPair,
  TokenPayload,
  User,
} from '../../dist/index.js';
import {
  AuthError,
  allOf,
  anyOf,
  authenticated,
  authorize,
  can,
  cannot,
  createAdminOnlyPolicy,
  createOwnerOrAdminPolicy,
  createPolicyBuilder,
  createReadOnlyPolicy,
  defineGuard,
  definePolicy,
  emailVerified,
  executeGuard,
  executeGuards,
  getPolicy,
  guard,
  hasAnyPermission,
  hasPermission,
  hasRole,
  not,
  registerPolicy,
  userCan,
} from '../../dist/index.js';

// ============================================================================
// User Type Tests
// ============================================================================

// User has required fields
const user: User = {
  id: '123',
  email: 'test@example.com',
};
expectType<string>(user.id);
expectType<string>(user.email);

// Optional fields
const userWithRoles: User = {
  id: '123',
  email: 'test@example.com',
  roles: ['admin', 'user'],
  permissions: ['posts.read', 'posts.write'],
};
expectType<string[] | undefined>(userWithRoles.roles);
expectType<string[] | undefined>(userWithRoles.permissions);

// User allows additional properties via index signature
const extendedUser: User = {
  id: '123',
  email: 'test@example.com',
  customField: 'value',
  anotherField: 123,
};
expectType<unknown>(extendedUser.customField);

// ============================================================================
// TokenPayload Type Tests
// ============================================================================

const tokenPayload: TokenPayload = {
  sub: '123',
  email: 'test@example.com',
  type: 'access',
  iat: 1234567890,
  exp: 1234567890,
};

expectType<string>(tokenPayload.sub);
expectType<string>(tokenPayload.email);
expectType<'access' | 'refresh'>(tokenPayload.type);
expectType<number>(tokenPayload.iat);
expectType<number>(tokenPayload.exp);
expectType<string | undefined>(tokenPayload.jti);
expectType<string | undefined>(tokenPayload.iss);
expectType<string | undefined>(tokenPayload.aud);
expectType<number | undefined>(tokenPayload.nbf);

// ============================================================================
// TokenPair Type Tests
// ============================================================================

const tokenPair: TokenPair = {
  accessToken: 'access.token.here',
  refreshToken: 'refresh.token.here',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

expectType<string>(tokenPair.accessToken);
expectType<string>(tokenPair.refreshToken);
expectType<number>(tokenPair.expiresIn);
expectType<'Bearer'>(tokenPair.tokenType);

// ============================================================================
// Configuration Types
// ============================================================================

// JwtConfig
const jwtConfig: JwtConfig = {
  secret: 'my-secret',
  refreshSecret: 'refresh-secret',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'veloxts',
  audience: 'my-app',
};

expectType<string>(jwtConfig.secret);
expectType<string | undefined>(jwtConfig.refreshSecret);
expectType<string | undefined>(jwtConfig.accessTokenExpiry);
expectType<string | undefined>(jwtConfig.refreshTokenExpiry);

// HashConfig
const hashConfig: HashConfig = {
  algorithm: 'bcrypt',
  bcryptRounds: 12,
};

expectType<'bcrypt' | 'argon2' | undefined>(hashConfig.algorithm);
expectType<number | undefined>(hashConfig.bcryptRounds);

// AuthConfig
const authConfig: AuthConfig = {
  jwt: jwtConfig,
  hash: hashConfig,
  userLoader: async (userId: string) => ({ id: userId, email: 'test@example.com' }),
  isTokenRevoked: async () => false,
};

expectType<JwtConfig>(authConfig.jwt);
expectType<HashConfig | undefined>(authConfig.hash);
expectType<((userId: string) => Promise<User | null>) | undefined>(authConfig.userLoader);

// ============================================================================
// AuthError Type Tests
// ============================================================================

const authError = new AuthError('Unauthorized', 401, 'AUTH_REQUIRED');
expectAssignable<Error>(authError);
expectType<number>(authError.statusCode);
expectType<string>(authError.code);
expectType<string>(authError.message);

// ============================================================================
// GuardFunction Type Tests
// ============================================================================

// GuardFunction accepts context, request, and reply
const simpleGuard: GuardFunction<{ user?: User }> = (ctx, request, reply) => {
  expectAssignable<{ user?: User }>(ctx);
  expectAssignable<FastifyRequest>(request);
  expectAssignable<FastifyReply>(reply);
  return ctx.user !== undefined;
};

// Async guard function
const asyncGuard: GuardFunction<{ user?: User }> = async (ctx) => {
  return ctx.user !== undefined;
};

// Guard function return type
expectAssignable<boolean | Promise<boolean>>(
  simpleGuard({}, {} as FastifyRequest, {} as FastifyReply)
);
expectAssignable<boolean | Promise<boolean>>(
  asyncGuard({}, {} as FastifyRequest, {} as FastifyReply)
);

// ============================================================================
// GuardDefinition Type Tests
// ============================================================================

// defineGuard returns GuardDefinition
const customGuard = defineGuard({
  name: 'customGuard',
  check: (ctx: { user?: User }) => ctx.user !== undefined,
  message: 'Custom guard failed',
  statusCode: 403,
});

expectType<GuardDefinition<{ user?: User }>>(customGuard);
expectType<string>(customGuard.name);
expectType<GuardFunction<{ user?: User }>>(customGuard.check);
expectType<string | undefined>(customGuard.message);
expectType<number | undefined>(customGuard.statusCode);

// guard() helper
const shortGuard = guard<{ user?: User }>('shortGuard', (ctx) => ctx.user !== undefined);
expectType<GuardDefinition<{ user?: User }>>(shortGuard);

// ============================================================================
// Built-in Guards Type Tests
// ============================================================================

// authenticated guard
expectType<GuardDefinition<{ auth?: AuthContext }>>(authenticated);
expectType<string>(authenticated.name);
expectType<number | undefined>(authenticated.statusCode);

// emailVerified guard
expectType<GuardDefinition<{ user?: User }>>(emailVerified);

// hasRole guard
const adminGuard = hasRole('admin');
expectType<GuardDefinition<{ user?: User }>>(adminGuard);

const multiRoleGuard = hasRole(['admin', 'moderator']);
expectType<GuardDefinition<{ user?: User }>>(multiRoleGuard);

// hasPermission guard
const editPermGuard = hasPermission('posts.edit');
expectType<GuardDefinition<{ user?: User }>>(editPermGuard);

const multiPermGuard = hasPermission(['users.create', 'users.delete']);
expectType<GuardDefinition<{ user?: User }>>(multiPermGuard);

// hasAnyPermission guard
const anyPermGuard = hasAnyPermission(['posts.view', 'posts.edit']);
expectType<GuardDefinition<{ user?: User }>>(anyPermGuard);

// userCan guard
const premiumGuard = userCan((u) => {
  expectType<User>(u);
  return u.email.endsWith('@premium.com');
});
expectType<GuardDefinition<{ user?: User }>>(premiumGuard);

// ============================================================================
// Guard Combinators Type Tests
// ============================================================================

// allOf combines guards with AND logic
const adminWithPerm = allOf([hasRole('admin'), hasPermission('users.delete')]);
expectType<GuardDefinition<{ user?: User }>>(adminWithPerm);

// anyOf combines guards with OR logic
const adminOrMod = anyOf([hasRole('admin'), hasRole('moderator')]);
expectType<GuardDefinition<{ user?: User }>>(adminOrMod);

// not inverts a guard
const notAdmin = not(hasRole('admin'));
expectType<GuardDefinition<{ user?: User }>>(notAdmin);

// ============================================================================
// Guard Execution Type Tests
// ============================================================================

// executeGuard returns result object
declare const testCtx: { user?: User };
declare const testReq: FastifyRequest;
declare const testReply: FastifyReply;

const guardResult = executeGuard(hasRole('admin'), testCtx, testReq, testReply);
expectType<Promise<{ passed: boolean; message?: string; statusCode?: number }>>(guardResult);

// executeGuards returns result with failedGuard
const guardsResult = executeGuards(
  [hasRole('admin'), hasPermission('users.delete')],
  testCtx,
  testReq,
  testReply
);
expectType<
  Promise<{ passed: boolean; failedGuard?: string; message?: string; statusCode?: number }>
>(guardsResult);

// ============================================================================
// PolicyAction Type Tests
// ============================================================================

// PolicyAction takes user and resource
const viewAction: PolicyAction<User, { id: string }> = (u, resource) => {
  expectType<User>(u);
  expectType<{ id: string }>(resource);
  return true;
};

// Keep viewAction used
expectType<boolean | Promise<boolean>>(viewAction(user, { id: '1' }));

// ============================================================================
// PolicyDefinition Type Tests
// ============================================================================

// definePolicy preserves types
interface Post {
  id: string;
  authorId: string;
  title: string;
}

const postPolicy = definePolicy<User, Post>({
  view: () => true,
  create: (u) => u.email !== undefined,
  update: (u, post) => u.id === post.authorId,
  delete: (u, post) => u.id === post.authorId,
});

expectType<PolicyDefinition<User, Post>>(postPolicy);
expectType<PolicyAction<User, Post> | undefined>(postPolicy.view);
expectType<PolicyAction<User, Post> | undefined>(postPolicy.create);
expectType<PolicyAction<User, Post> | undefined>(postPolicy.update);
expectType<PolicyAction<User, Post> | undefined>(postPolicy.delete);

// Custom actions via index signature
const policyWithCustom = definePolicy<User, Post>({
  view: () => true,
  publish: (u, post) => u.id === post.authorId,
  archive: (u) => u.roles?.includes('admin') ?? false,
});
expectType<PolicyAction<User, Post> | undefined>(policyWithCustom.publish);
expectType<PolicyAction<User, Post> | undefined>(policyWithCustom.archive);

// ============================================================================
// Policy Registry Type Tests
// ============================================================================

// registerPolicy accepts policy definition
registerPolicy<User, Post>('Post', postPolicy);

// getPolicy returns PolicyDefinition or undefined
const retrievedPolicy = getPolicy('Post');
expectType<PolicyDefinition | undefined>(retrievedPolicy);

// ============================================================================
// Authorization Check Type Tests
// ============================================================================

// can returns Promise<boolean>
const canViewResult = can(user, 'view', 'Post', { id: '1', authorId: '123', title: 'Test' });
expectType<Promise<boolean>>(canViewResult);

// can with undefined resource
const canCreateResult = can(user, 'create', 'Post');
expectType<Promise<boolean>>(canCreateResult);

// can with null user
const nullUserResult = can(null, 'view', 'Post');
expectType<Promise<boolean>>(nullUserResult);

// cannot is inverse of can
const cannotDeleteResult = cannot(user, 'delete', 'Post', {
  id: '1',
  authorId: '456',
  title: 'Test',
});
expectType<Promise<boolean>>(cannotDeleteResult);

// authorize returns Promise<void>
const authorizeResult = authorize(user, 'view', 'Post', {
  id: '1',
  authorId: '123',
  title: 'Test',
});
expectType<Promise<void>>(authorizeResult);

// ============================================================================
// Policy Builder Type Tests
// ============================================================================

// createPolicyBuilder returns typed builder
interface Comment {
  id: string;
  userId: string;
  content: string;
}

const commentPolicy = createPolicyBuilder<User, Comment>()
  .allow('view', () => true)
  .allow('create', (u) => u.email !== undefined)
  .allowOwner('update', 'userId')
  .allowOwnerOr('delete', ['admin', 'moderator'], 'userId')
  .deny('archive')
  .build();

expectType<PolicyDefinition<User, Comment>>(commentPolicy);

// ============================================================================
// Common Policy Pattern Type Tests
// ============================================================================

// createOwnerOrAdminPolicy
interface Article {
  id: string;
  userId: string;
  title: string;
}

const ownerOrAdminPolicy = createOwnerOrAdminPolicy<Article>('userId');
expectType<PolicyDefinition<User & { role?: string }, Article>>(ownerOrAdminPolicy);

// createReadOnlyPolicy
const readOnlyPolicy = createReadOnlyPolicy<Article>();
expectType<PolicyDefinition<User, Article>>(readOnlyPolicy);

// createAdminOnlyPolicy
const adminOnlyPolicy = createAdminOnlyPolicy<Article>();
expectType<PolicyDefinition<User & { role?: string }, Article>>(adminOnlyPolicy);

// ============================================================================
// AuthContext Type Tests
// ============================================================================

const authContext: AuthContext = {
  user: { id: '1', email: 'test@example.com' },
  token: {
    sub: '1',
    email: 'test@example.com',
    type: 'access',
    iat: 1234567890,
    exp: 1234567890,
  },
  isAuthenticated: true,
};

expectType<User | undefined>(authContext.user);
expectType<TokenPayload | undefined>(authContext.token);
expectType<boolean>(authContext.isAuthenticated);

// ============================================================================
// AuthMiddlewareOptions Type Tests
// ============================================================================

const middlewareOptions: AuthMiddlewareOptions = {
  optional: true,
  guards: [authenticated as GuardDefinition, 'customGuard'],
};

expectType<boolean | undefined>(middlewareOptions.optional);
expectType<Array<GuardDefinition | string> | undefined>(middlewareOptions.guards);

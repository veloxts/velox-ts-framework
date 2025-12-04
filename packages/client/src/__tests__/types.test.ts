/**
 * @veloxts/client - Type Inference Tests
 *
 * These tests verify that type inference works correctly at compile time.
 * Runtime assertions are minimal since the primary value is type checking.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ClientFromCollection,
  ClientFromRouter,
  ClientProcedure,
  InferProcedureInput,
  InferProcedureOutput,
  ProcedureCollection,
} from '../types.js';

describe('Type Inference', () => {
  describe('InferProcedureInput', () => {
    it('should infer input type from procedure', () => {
      type TestProcedure = ClientProcedure<{ id: string }, { name: string }>;
      type Input = InferProcedureInput<TestProcedure>;

      expectTypeOf<Input>().toEqualTypeOf<{ id: string }>();
    });

    it('should infer unknown for procedure without input', () => {
      type TestProcedure = ClientProcedure<unknown, string>;
      type Input = InferProcedureInput<TestProcedure>;

      expectTypeOf<Input>().toEqualTypeOf<unknown>();
    });
  });

  describe('InferProcedureOutput', () => {
    it('should infer output type from procedure', () => {
      type TestProcedure = ClientProcedure<void, { name: string; email: string }>;
      type Output = InferProcedureOutput<TestProcedure>;

      expectTypeOf<Output>().toEqualTypeOf<{ name: string; email: string }>();
    });

    it('should infer unknown for procedure without output', () => {
      type TestProcedure = ClientProcedure<{ id: string }, unknown>;
      type Output = InferProcedureOutput<TestProcedure>;

      expectTypeOf<Output>().toEqualTypeOf<unknown>();
    });
  });

  describe('ClientFromCollection', () => {
    it('should create callable interface from collection', () => {
      interface UserCollection extends ProcedureCollection {
        namespace: 'users';
        procedures: {
          getUser: ClientProcedure<{ id: string }, { id: string; name: string }>;
          listUsers: ClientProcedure<void, Array<{ id: string; name: string }>>;
        };
      }

      type Client = ClientFromCollection<UserCollection>;

      // Verify structure
      expectTypeOf<Client>().toHaveProperty('getUser');
      expectTypeOf<Client>().toHaveProperty('listUsers');

      // Verify getUser signature
      expectTypeOf<Client['getUser']>().toBeFunction();
      expectTypeOf<Client['getUser']>().parameter(0).toEqualTypeOf<{ id: string }>();
      expectTypeOf<Client['getUser']>().returns.toEqualTypeOf<
        Promise<{ id: string; name: string }>
      >();

      // Verify listUsers signature
      expectTypeOf<Client['listUsers']>().parameter(0).toEqualTypeOf<void>();
      expectTypeOf<Client['listUsers']>().returns.toEqualTypeOf<
        Promise<Array<{ id: string; name: string }>>
      >();
    });
  });

  describe('ClientFromRouter', () => {
    it('should create namespaced client from router', () => {
      interface UserCollection extends ProcedureCollection {
        namespace: 'users';
        procedures: {
          getUser: ClientProcedure<{ id: string }, { id: string; name: string }>;
          createUser: ClientProcedure<{ name: string }, { id: string; name: string }>;
        };
      }

      interface PostCollection extends ProcedureCollection {
        namespace: 'posts';
        procedures: {
          getPost: ClientProcedure<{ id: string }, { id: string; title: string }>;
          listPosts: ClientProcedure<{ page?: number }, Array<{ id: string; title: string }>>;
        };
      }

      type Router = {
        users: UserCollection;
        posts: PostCollection;
      };

      type Client = ClientFromRouter<Router>;

      // Verify namespaces exist
      expectTypeOf<Client>().toHaveProperty('users');
      expectTypeOf<Client>().toHaveProperty('posts');

      // Verify users namespace procedures
      expectTypeOf<Client['users']>().toHaveProperty('getUser');
      expectTypeOf<Client['users']>().toHaveProperty('createUser');

      // Verify posts namespace procedures
      expectTypeOf<Client['posts']>().toHaveProperty('getPost');
      expectTypeOf<Client['posts']>().toHaveProperty('listPosts');

      // Verify specific procedure types
      expectTypeOf<Client['users']['getUser']>().parameter(0).toEqualTypeOf<{ id: string }>();
      expectTypeOf<Client['users']['createUser']>().parameter(0).toEqualTypeOf<{ name: string }>();
      expectTypeOf<Client['posts']['listPosts']>().parameter(0).toEqualTypeOf<{ page?: number }>();
    });

    it('should return never for non-collection properties', () => {
      type BadRouter = {
        users: ProcedureCollection;
        notACollection: { foo: 'bar' };
      };

      type Client = ClientFromRouter<BadRouter>;

      expectTypeOf<Client['notACollection']>().toBeNever();
    });
  });

  describe('Runtime validation', () => {
    it('should create valid type definitions at runtime', () => {
      // These are just runtime existence checks
      // The real value is in the compile-time type checking above
      const procedureTypes = {
        getUser: {} as ClientProcedure<{ id: string }, { name: string }>,
        createUser: {} as ClientProcedure<{ name: string }, { id: string; name: string }>,
      };

      expect(procedureTypes.getUser).toBeDefined();
      expect(procedureTypes.createUser).toBeDefined();
    });
  });
});

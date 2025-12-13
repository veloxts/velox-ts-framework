/**
 * Unit tests for React hooks (useQuery, useMutation, useQueryClient)
 */

import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMutation, useQuery, useQueryClient } from '../hooks.js';
import { VeloxProvider } from '../provider.js';

// ============================================================================
// Test Setup
// ============================================================================

// Mock procedure types for testing
interface MockUser {
  id: string;
  name: string;
  email: string;
}

interface MockUserInput {
  id: string;
}

interface MockCreateUserInput {
  name: string;
  email: string;
}

// Mock client
const mockGetUser = vi.fn();
const mockListUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();

const mockClient = {
  users: {
    getUser: mockGetUser,
    listUsers: mockListUsers,
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
  },
};

// Mock createClient to return our mock client
vi.mock('../../client.js', () => ({
  createClient: vi.fn(() => mockClient),
}));

// Type for our mock router
type MockRouter = {
  users: {
    namespace: 'users';
    procedures: {
      getUser: { type: 'query'; handler: (args: { input: MockUserInput }) => Promise<MockUser> };
      listUsers: { type: 'query'; handler: () => Promise<MockUser[]> };
      createUser: {
        type: 'mutation';
        handler: (args: { input: MockCreateUserInput }) => Promise<MockUser>;
      };
      updateUser: {
        type: 'mutation';
        handler: (args: { input: MockUserInput & Partial<MockUser> }) => Promise<MockUser>;
      };
    };
  };
};

// Wrapper component for hooks
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VeloxProvider<MockRouter> config={{ baseUrl: '/api' }} queryClient={queryClient}>
        {children}
      </VeloxProvider>
    );
  }

  return { Wrapper, queryClient };
}

// ============================================================================
// useQuery Tests
// ============================================================================

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches data successfully', async () => {
    const mockUser: MockUser = { id: '123', name: 'Test User', email: 'test@example.com' };
    mockGetUser.mockResolvedValueOnce(mockUser);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useQuery<MockRouter, 'users', 'getUser'>('users', 'getUser', { id: '123' }),
      { wrapper: Wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUser);
    expect(mockGetUser).toHaveBeenCalledWith({ id: '123' });
  });

  it('handles errors', async () => {
    const error = new Error('Not found');
    mockGetUser.mockRejectedValueOnce(error);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useQuery<MockRouter, 'users', 'getUser'>('users', 'getUser', { id: 'invalid' }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('Not found');
  });

  it('respects enabled option', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery<MockRouter, 'users', 'getUser'>(
          'users',
          'getUser',
          { id: '123' },
          { enabled: false }
        ),
      { wrapper: Wrapper }
    );

    // Should not be loading when disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('refetches on input change', async () => {
    const user1: MockUser = { id: '1', name: 'User 1', email: 'user1@example.com' };
    const user2: MockUser = { id: '2', name: 'User 2', email: 'user2@example.com' };

    mockGetUser.mockResolvedValueOnce(user1).mockResolvedValueOnce(user2);

    const { Wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useQuery<MockRouter, 'users', 'getUser'>('users', 'getUser', { id }),
      { wrapper: Wrapper, initialProps: { id: '1' } }
    );

    await waitFor(() => expect(result.current.data).toEqual(user1));

    // Change input
    rerender({ id: '2' });

    await waitFor(() => expect(result.current.data).toEqual(user2));

    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// useMutation Tests
// ============================================================================

describe('useMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('executes mutation successfully', async () => {
    const newUser: MockUser = { id: 'new-id', name: 'New User', email: 'new@example.com' };
    mockCreateUser.mockResolvedValueOnce(newUser);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser'),
      { wrapper: Wrapper }
    );

    expect(result.current.isPending).toBe(false);

    // Execute mutation
    act(() => {
      result.current.mutate({ name: 'New User', email: 'new@example.com' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(newUser);
    expect(mockCreateUser).toHaveBeenCalledWith({ name: 'New User', email: 'new@example.com' });
  });

  it('handles mutation errors', async () => {
    const error = new Error('Validation failed');
    mockCreateUser.mockRejectedValueOnce(error);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser'),
      { wrapper: Wrapper }
    );

    act(() => {
      result.current.mutate({ name: '', email: 'invalid' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Validation failed');
  });

  it('calls onSuccess callback', async () => {
    const newUser: MockUser = { id: 'new-id', name: 'New User', email: 'new@example.com' };
    mockCreateUser.mockResolvedValueOnce(newUser);

    const onSuccess = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser', { onSuccess }),
      { wrapper: Wrapper }
    );

    act(() => {
      result.current.mutate({ name: 'New User', email: 'new@example.com' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalledWith(
      newUser,
      { name: 'New User', email: 'new@example.com' },
      undefined,
      expect.objectContaining({ client: expect.any(Object) })
    );
  });

  it('calls onError callback', async () => {
    const error = new Error('Server error');
    mockCreateUser.mockRejectedValueOnce(error);

    const onError = vi.fn();
    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser', { onError }),
      { wrapper: Wrapper }
    );

    act(() => {
      result.current.mutate({ name: 'Test', email: 'test@example.com' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(onError).toHaveBeenCalled();
  });

  it('supports mutateAsync for promise-based usage', async () => {
    const newUser: MockUser = { id: 'new-id', name: 'New User', email: 'new@example.com' };
    mockCreateUser.mockResolvedValueOnce(newUser);

    const { Wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser'),
      { wrapper: Wrapper }
    );

    let returnedUser: MockUser | undefined;
    await act(async () => {
      returnedUser = await result.current.mutateAsync({
        name: 'New User',
        email: 'new@example.com',
      });
    });

    expect(returnedUser).toEqual(newUser);
  });
});

// ============================================================================
// useQueryClient Tests
// ============================================================================

describe('useQueryClient', () => {
  it('returns the QueryClient instance', () => {
    const { Wrapper, queryClient: expectedClient } = createWrapper();

    const { result } = renderHook(() => useQueryClient(), { wrapper: Wrapper });

    expect(result.current).toBe(expectedClient);
  });

  it('allows manual cache manipulation', async () => {
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useQueryClient(), { wrapper: Wrapper });

    // Set data manually
    act(() => {
      result.current.setQueryData(['users', 'getUser', { id: '123' }], {
        id: '123',
        name: 'Cached User',
        email: 'cached@example.com',
      });
    });

    const cachedData = queryClient.getQueryData(['users', 'getUser', { id: '123' }]);
    expect(cachedData).toEqual({
      id: '123',
      name: 'Cached User',
      email: 'cached@example.com',
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('hooks integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mutation onSuccess callback receives correct data', async () => {
    const newUser: MockUser = { id: '2', name: 'User 2', email: 'user2@example.com' };
    mockCreateUser.mockResolvedValueOnce(newUser);

    const { Wrapper } = createWrapper();
    const onSuccessData: MockUser[] = [];

    const { result } = renderHook(
      () =>
        useMutation<MockRouter, 'users', 'createUser'>('users', 'createUser', {
          onSuccess: (data) => {
            onSuccessData.push(data);
          },
        }),
      { wrapper: Wrapper }
    );

    // Execute mutation
    act(() => {
      result.current.mutate({ name: 'User 2', email: 'user2@example.com' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // onSuccess should have received the created user
    expect(onSuccessData).toHaveLength(1);
    expect(onSuccessData[0]).toEqual(newUser);
  });

  it('useQueryClient returns a working query client instance', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueryClient(), { wrapper: Wrapper });

    // Should be a QueryClient instance
    expect(result.current).toBeDefined();
    expect(typeof result.current.invalidateQueries).toBe('function');
    expect(typeof result.current.setQueryData).toBe('function');
    expect(typeof result.current.getQueryData).toBe('function');
  });
});

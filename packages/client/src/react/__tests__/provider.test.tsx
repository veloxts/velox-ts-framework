/**
 * Unit tests for VeloxProvider component
 */

import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVeloxContext, VeloxProvider } from '../provider.js';

// ============================================================================
// Test Setup
// ============================================================================

// Mock the createClient function
vi.mock('../../client.js', () => ({
  createClient: vi.fn((config) => ({
    _config: config,
    users: {
      getUser: vi.fn().mockResolvedValue({ id: '123', name: 'Test User' }),
    },
  })),
}));

// Test consumer component that uses the context
function TestConsumer() {
  const { client } = useVeloxContext<{ users: { getUser: () => Promise<unknown> } }>();
  return <div data-testid="has-client">{client ? 'Client available' : 'No client'}</div>;
}

// ============================================================================
// VeloxProvider Tests
// ============================================================================

describe('VeloxProvider', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders children', () => {
    render(
      <VeloxProvider config={{ baseUrl: '/api' }} queryClient={queryClient}>
        <div data-testid="child">Hello</div>
      </VeloxProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('provides client context to children', () => {
    render(
      <VeloxProvider config={{ baseUrl: '/api' }} queryClient={queryClient}>
        <TestConsumer />
      </VeloxProvider>
    );

    expect(screen.getByTestId('has-client')).toHaveTextContent('Client available');
  });

  it('accepts custom QueryClient', () => {
    const customQueryClient = new QueryClient();

    render(
      <VeloxProvider config={{ baseUrl: '/api' }} queryClient={customQueryClient}>
        <TestConsumer />
      </VeloxProvider>
    );

    expect(screen.getByTestId('has-client')).toHaveTextContent('Client available');
  });

  it('creates default QueryClient when not provided', () => {
    render(
      <VeloxProvider config={{ baseUrl: '/api' }}>
        <TestConsumer />
      </VeloxProvider>
    );

    expect(screen.getByTestId('has-client')).toHaveTextContent('Client available');
  });
});

// ============================================================================
// useVeloxContext Tests
// ============================================================================

describe('useVeloxContext', () => {
  it('throws when used outside VeloxProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useVeloxContext must be used within a VeloxProvider');

    consoleSpy.mockRestore();
  });

  it('returns context with client when inside VeloxProvider', () => {
    const queryClient = new QueryClient();

    render(
      <VeloxProvider config={{ baseUrl: '/api' }} queryClient={queryClient}>
        <TestConsumer />
      </VeloxProvider>
    );

    expect(screen.getByTestId('has-client')).toHaveTextContent('Client available');
  });
});

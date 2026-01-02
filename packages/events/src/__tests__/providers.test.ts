/**
 * Tests for Events DI Providers
 *
 * Validates:
 * - registerEventsProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Events manager is properly initialized
 */

import { Container } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerEventsProviders } from '../providers.js';
import { EVENTS_CONFIG, EVENTS_DRIVER, EVENTS_MANAGER } from '../tokens.js';
import type { BroadcastDriver, EventsManager } from '../types.js';

describe('Events DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    // Clean up any events managers created
    if (container.isRegistered(EVENTS_MANAGER)) {
      const events = container.resolve(EVENTS_MANAGER);
      await events.close();
    }
  });

  describe('registerEventsProviders', () => {
    it('registers events config, driver, and manager', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      expect(container.isRegistered(EVENTS_CONFIG)).toBe(true);
      expect(container.isRegistered(EVENTS_DRIVER)).toBe(true);
      expect(container.isRegistered(EVENTS_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', async () => {
      await registerEventsProviders(container, {
        driver: 'sse',
        path: '/events',
        pingInterval: 15000,
      });

      const config = container.resolve(EVENTS_CONFIG);

      expect(config.driver).toBe('sse');
      expect((config as { path: string }).path).toBe('/events');
      expect(config.pingInterval).toBe(15000);
    });

    it('uses ws driver by default', async () => {
      await registerEventsProviders(container);

      const config = container.resolve(EVENTS_CONFIG);

      expect(config.driver).toBeUndefined(); // defaults to ws internally
    });

    it('events manager is fully functional after registration', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      // Broadcast should work (SSE driver doesn't actually send without connections)
      await expect(
        events.broadcast('test-channel', 'test-event', { message: 'Hello' })
      ).resolves.toBeUndefined();
    });

    it('events manager supports broadcastToMany', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      await expect(
        events.broadcastToMany(['channel-1', 'channel-2'], 'event', { data: 'test' })
      ).resolves.toBeUndefined();
    });

    it('events manager supports toOthers', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      await expect(
        events.toOthers('channel', 'event', { data: 'test' }, 'socket-id')
      ).resolves.toBeUndefined();
    });

    it('events manager supports subscriberCount', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      const count = await events.subscriberCount('test-channel');
      expect(count).toBe(0); // No subscribers yet
    });

    it('events manager supports hasSubscribers', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      const hasSubscribers = await events.hasSubscribers('test-channel');
      expect(hasSubscribers).toBe(false);
    });

    it('events manager supports channels', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      const channels = await events.channels();
      expect(Array.isArray(channels)).toBe(true);
    });

    it('events manager supports presenceMembers', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const events = container.resolve(EVENTS_MANAGER);

      const members = await events.presenceMembers('presence-channel');
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBe(0);
    });

    it('driver is accessible from container', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const driver = container.resolve(EVENTS_DRIVER);

      expect(driver).toBeDefined();
      expect(typeof driver.broadcast).toBe('function');
      expect(typeof driver.close).toBe('function');
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking EVENTS_MANAGER after registration', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      // Create a mock events manager
      const mockEventsManager: Partial<EventsManager> = {
        broadcast: vi.fn().mockResolvedValue(undefined),
        broadcastToMany: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: EVENTS_MANAGER, useValue: mockEventsManager });

      const events = container.resolve(EVENTS_MANAGER);

      expect(events).toBe(mockEventsManager);

      await events.broadcast('channel', 'event', { data: 'test' });
      expect(mockEventsManager.broadcast).toHaveBeenCalledWith('channel', 'event', {
        data: 'test',
      });
    });

    it('allows mocking EVENTS_DRIVER after registration', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const mockDriver: Partial<BroadcastDriver> = {
        broadcast: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        getConnectionCount: vi.fn().mockResolvedValue(5),
      };

      container.register({ provide: EVENTS_DRIVER, useValue: mockDriver });

      const driver = container.resolve(EVENTS_DRIVER);

      expect(driver).toBe(mockDriver);
      expect(await driver.getConnectionCount('channel')).toBe(5);
    });

    it('allows mocking EVENTS_CONFIG after registration', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const mockConfig = {
        driver: 'ws' as const,
        path: '/mock-ws',
        redis: 'redis://localhost:6379',
      };
      container.register({ provide: EVENTS_CONFIG, useValue: mockConfig });

      const config = container.resolve(EVENTS_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.driver).toBe('ws');
    });

    it('child container can override parent registrations', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const childContainer = container.createChild();

      const mockEventsManager: Partial<EventsManager> = {
        broadcast: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      childContainer.register({ provide: EVENTS_MANAGER, useValue: mockEventsManager });

      const parentEvents = container.resolve(EVENTS_MANAGER);
      const childEvents = childContainer.resolve(EVENTS_MANAGER);

      expect(childEvents).toBe(mockEventsManager);
      expect(parentEvents).not.toBe(mockEventsManager);
    });

    it('child container inherits parent registrations', async () => {
      await registerEventsProviders(container, { driver: 'sse' });

      const childContainer = container.createChild();

      // Should resolve from parent
      const events = childContainer.resolve(EVENTS_MANAGER);
      const config = childContainer.resolve(EVENTS_CONFIG);
      const driver = childContainer.resolve(EVENTS_DRIVER);

      expect(events).toBeDefined();
      expect(config).toBeDefined();
      expect(driver).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered EVENTS_MANAGER token', () => {
      expect(() => container.resolve(EVENTS_MANAGER)).toThrow(
        'No provider found for: EVENTS_MANAGER'
      );
    });

    it('throws when resolving unregistered EVENTS_DRIVER token', () => {
      expect(() => container.resolve(EVENTS_DRIVER)).toThrow(
        'No provider found for: EVENTS_DRIVER'
      );
    });

    it('throws when resolving EVENTS_CONFIG without registration', () => {
      expect(() => container.resolve(EVENTS_CONFIG)).toThrow(
        'No provider found for: EVENTS_CONFIG'
      );
    });
  });

  describe('Integration with Real Services', () => {
    it('complete events flow works with DI-provided services', async () => {
      await registerEventsProviders(container, {
        driver: 'sse',
        path: '/events',
        pingInterval: 30000,
      });

      const events = container.resolve(EVENTS_MANAGER);
      const config = container.resolve(EVENTS_CONFIG);
      const driver = container.resolve(EVENTS_DRIVER);

      // Config should be accessible
      expect(config.driver).toBe('sse');
      expect((config as { path: string }).path).toBe('/events');

      // Driver should be functional
      expect(typeof driver.broadcast).toBe('function');

      // Events should be functional
      await expect(
        events.broadcast('integration-channel', 'test-event', { message: 'Integration test' })
      ).resolves.toBeUndefined();

      // Check channel info
      const channels = await events.channels();
      expect(Array.isArray(channels)).toBe(true);
    });

    it('multiple containers can have independent events instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      await registerEventsProviders(container1, {
        driver: 'sse',
        path: '/events1',
      });

      await registerEventsProviders(container2, {
        driver: 'sse',
        path: '/events2',
      });

      const events1 = container1.resolve(EVENTS_MANAGER);
      const events2 = container2.resolve(EVENTS_MANAGER);

      // Different instances
      expect(events1).not.toBe(events2);

      // Different configs
      const config1 = container1.resolve(EVENTS_CONFIG);
      const config2 = container2.resolve(EVENTS_CONFIG);
      expect((config1 as { path: string }).path).toBe('/events1');
      expect((config2 as { path: string }).path).toBe('/events2');

      // Cleanup
      await events1.close();
      await events2.close();
    });

    it('supports SSE driver configuration', async () => {
      await registerEventsProviders(container, {
        driver: 'sse',
        path: '/events',
        heartbeatInterval: 10000,
        retryInterval: 5000,
      });

      const config = container.resolve(EVENTS_CONFIG);
      const events = container.resolve(EVENTS_MANAGER);

      expect(config.driver).toBe('sse');
      expect((config as { heartbeatInterval?: number }).heartbeatInterval).toBe(10000);
      expect((config as { retryInterval?: number }).retryInterval).toBe(5000);

      // Manager should work
      const count = await events.subscriberCount('any-channel');
      expect(count).toBe(0);
    });
  });
});

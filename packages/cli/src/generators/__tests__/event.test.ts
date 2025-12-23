/**
 * Event Generator - Unit Tests
 *
 * Tests for event, listener, and channel generation.
 */

import { describe, expect, it } from 'vitest';

import { createEventGenerator } from '../generators/event.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('EventGenerator', () => {
  const generator = createEventGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    name: 'test-app',
    hasAuth: false,
    database: 'sqlite',
    projectType: 'api',
    isVinxiProject: false,
    hasWeb: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('event');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('ev');
      expect(generator.metadata.aliases).toContain('broadcast');
    });

    it('should be in infrastructure category', () => {
      expect(generator.metadata.category).toBe('infrastructure');
    });

    it('should have description', () => {
      expect(generator.metadata.description).toBeTruthy();
      expect(generator.metadata.description).toContain('event');
    });

    it('should have long description with examples', () => {
      expect(generator.metadata.longDescription).toBeTruthy();
      expect(generator.metadata.longDescription).toContain('listener');
      expect(generator.metadata.longDescription).toContain('channel');
    });
  });

  describe('validateEntityName', () => {
    it('should accept valid names', () => {
      expect(generator.validateEntityName('user-registered')).toBeUndefined();
      expect(generator.validateEntityName('order-created')).toBeUndefined();
      expect(generator.validateEntityName('NotificationSent')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123event')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.listener).toBe(false);
      expect(options.channel).toBe(false);
    });

    it('should accept listener option', () => {
      const options = generator.validateOptions({ listener: true });
      expect(options.listener).toBe(true);
      expect(options.channel).toBe(false);
    });

    it('should accept channel option', () => {
      const options = generator.validateOptions({ channel: true });
      expect(options.listener).toBe(false);
      expect(options.channel).toBe(true);
    });

    it('should throw error when both listener and channel are true', () => {
      expect(() => {
        generator.validateOptions({ listener: true, channel: true });
      }).toThrow('Cannot use both --listener and --channel');
    });
  });

  describe('generate - broadcast event (default)', () => {
    it('should generate broadcast event template by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'user-registered',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/events/user-registered.ts');
      expect(output.files[0].content).toContain('UserRegisteredEvent');
      expect(output.files[0].content).toContain('UserRegisteredEventSchema');
      expect(output.files[0].content).toContain('defineEvent');
      expect(output.files[0].content).toContain('userRegisteredEvent');
    });

    it('should include Zod schema validation', async () => {
      const config: GeneratorConfig = {
        entityName: 'order-created',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('OrderCreatedEventSchema');
      expect(content).toContain('z.object');
      expect(content).toContain('schema: OrderCreatedEventSchema');
    });

    it('should include broadcastOn configuration', async () => {
      const config: GeneratorConfig = {
        entityName: 'notification-sent',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('broadcastOn:');
      expect(content).toContain('notification-sent');
    });

    it('should include optional broadcast configuration methods', async () => {
      const config: GeneratorConfig = {
        entityName: 'payment-processed',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('broadcastWith');
      expect(content).toContain('shouldBroadcast');
    });

    it('should use kebab-case for event name', async () => {
      const config: GeneratorConfig = {
        entityName: 'OrderCreated',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("name: 'order-created'");
    });
  });

  describe('generate - event listener', () => {
    it('should generate event listener when listener option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'order-created',
        options: { listener: true, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/events/listeners/order-created.ts');
      expect(output.files[0].content).toContain('OrderCreated Listener');
      expect(output.files[0].content).toContain('defineListener');
      expect(output.files[0].content).toContain('orderCreatedListener');
    });

    it('should include handler function in listener', async () => {
      const config: GeneratorConfig = {
        entityName: 'user-updated',
        options: { listener: true, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('handler: async ({');
      expect(content).toContain('data, ctx');
      expect(content).toContain('Handling');
    });

    it('should include optional listener configuration', async () => {
      const config: GeneratorConfig = {
        entityName: 'email-sent',
        options: { listener: true, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('shouldHandle');
      expect(content).toContain('queue:');
    });

    it('should include schema validation for listener', async () => {
      const config: GeneratorConfig = {
        entityName: 'task-completed',
        options: { listener: true, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('TaskCompletedEventSchema');
      expect(content).toContain('schema: TaskCompletedEventSchema');
    });
  });

  describe('generate - channel', () => {
    it('should generate channel when channel option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'notifications',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/events/channels/notifications.ts');
      expect(output.files[0].content).toContain('Notification Channel');
      expect(output.files[0].content).toContain('defineChannel');
      expect(output.files[0].content).toContain('notificationChannel');
    });

    it('should include channel pattern configuration', async () => {
      const config: GeneratorConfig = {
        entityName: 'chat-room',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('pattern:');
      expect(content).toContain('chat-room');
      expect(content).toContain('{chatRoomId}');
    });

    it('should include authorization logic', async () => {
      const config: GeneratorConfig = {
        entityName: 'user-activity',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('authorize:');
      expect(content).toContain('params, ctx');
      expect(content).toContain('ctx.user');
    });

    it('should include channel params schema', async () => {
      const config: GeneratorConfig = {
        entityName: 'project-updates',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('ProjectUpdateChannelParamsSchema');
      expect(content).toContain('schema: ProjectUpdateChannelParamsSchema');
    });

    it('should include public channel variant', async () => {
      const config: GeneratorConfig = {
        entityName: 'announcements',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('publicAnnouncementChannel');
      expect(content).toContain('public.announcement');
      expect(content).toContain('Public channel');
    });

    it('should include optional channel configuration', async () => {
      const config: GeneratorConfig = {
        entityName: 'live-feed',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('transform:');
      expect(content).toContain('rateLimit:');
    });
  });

  describe('post-generation instructions', () => {
    it('should include instructions for broadcast event', async () => {
      const config: GeneratorConfig = {
        entityName: 'status-changed',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('event');
      expect(output.postInstructions).toContain('events.dispatch');
      expect(output.postInstructions).toContain('broadcastOn');
    });

    it('should include instructions for listener', async () => {
      const config: GeneratorConfig = {
        entityName: 'data-imported',
        options: { listener: true, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('listener');
      expect(output.postInstructions).toContain('events.listen');
      expect(output.postInstructions).toContain('handler');
    });

    it('should include instructions for channel', async () => {
      const config: GeneratorConfig = {
        entityName: 'team-chat',
        options: { listener: false, channel: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('channel');
      expect(output.postInstructions).toContain('authorization');
      expect(output.postInstructions).toContain('socket.subscribe');
    });
  });

  describe('entity name variations', () => {
    it('should handle PascalCase entity names', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserLoggedIn',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('UserLoggedInEvent');
      expect(content).toContain('userLoggedInEvent');
      expect(content).toContain("name: 'user-logged-in'");
    });

    it('should handle kebab-case entity names', async () => {
      const config: GeneratorConfig = {
        entityName: 'payment-failed',
        options: { listener: false, channel: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('PaymentFailedEvent');
      expect(content).toContain('paymentFailedEvent');
      expect(content).toContain("name: 'payment-failed'");
    });
  });
});

import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { createTenantCommand } from '../tenant.js';

describe('tenant command', () => {
  describe('createTenantCommand', () => {
    it('should create a command named "tenant"', () => {
      const command = createTenantCommand();

      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('tenant');
    });

    it('should have correct description', () => {
      const command = createTenantCommand();

      expect(command.description()).toBe('Multi-tenancy management commands');
    });

    it('should register all subcommands', () => {
      const command = createTenantCommand();
      const subcommands = command.commands.map((c) => c.name());

      expect(subcommands).toContain('create');
      expect(subcommands).toContain('list');
      expect(subcommands).toContain('migrate');
      expect(subcommands).toContain('status');
      expect(subcommands).toContain('suspend');
      expect(subcommands).toContain('activate');
      expect(subcommands).toHaveLength(6);
    });
  });

  describe('tenant:create', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const create = command.commands.find((c) => c.name() === 'create');

      expect(create).toBeDefined();
      expect(create?.description()).toBe('Create a new tenant with PostgreSQL schema');
    });

    it('should require slug argument', () => {
      const command = createTenantCommand();
      const create = command.commands.find((c) => c.name() === 'create');
      const args = create?.registeredArguments ?? [];

      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('slug');
      expect(args[0].required).toBe(true);
    });

    it('should have --name option', () => {
      const command = createTenantCommand();
      const create = command.commands.find((c) => c.name() === 'create');
      const options = create?.options ?? [];
      const nameOpt = options.find((o) => o.long === '--name');

      expect(nameOpt).toBeDefined();
      expect(nameOpt?.short).toBe('-n');
    });

    it('should have --dry-run option', () => {
      const command = createTenantCommand();
      const create = command.commands.find((c) => c.name() === 'create');
      const options = create?.options ?? [];
      const dryRunOpt = options.find((o) => o.long === '--dry-run');

      expect(dryRunOpt).toBeDefined();
    });

    it('should have --json option', () => {
      const command = createTenantCommand();
      const create = command.commands.find((c) => c.name() === 'create');
      const options = create?.options ?? [];
      const jsonOpt = options.find((o) => o.long === '--json');

      expect(jsonOpt).toBeDefined();
    });
  });

  describe('tenant:list', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const list = command.commands.find((c) => c.name() === 'list');

      expect(list).toBeDefined();
      expect(list?.description()).toBe('List all tenants');
    });

    it('should have --status option', () => {
      const command = createTenantCommand();
      const list = command.commands.find((c) => c.name() === 'list');
      const options = list?.options ?? [];
      const statusOpt = options.find((o) => o.long === '--status');

      expect(statusOpt).toBeDefined();
    });

    it('should have --json option', () => {
      const command = createTenantCommand();
      const list = command.commands.find((c) => c.name() === 'list');
      const options = list?.options ?? [];
      const jsonOpt = options.find((o) => o.long === '--json');

      expect(jsonOpt).toBeDefined();
    });
  });

  describe('tenant:migrate', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const migrate = command.commands.find((c) => c.name() === 'migrate');

      expect(migrate).toBeDefined();
      expect(migrate?.description()).toBe('Run migrations on tenant schemas');
    });

    it('should have optional slug argument', () => {
      const command = createTenantCommand();
      const migrate = command.commands.find((c) => c.name() === 'migrate');
      const args = migrate?.registeredArguments ?? [];

      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('slug');
      expect(args[0].required).toBe(false);
    });

    it('should have --all option', () => {
      const command = createTenantCommand();
      const migrate = command.commands.find((c) => c.name() === 'migrate');
      const options = migrate?.options ?? [];
      const allOpt = options.find((o) => o.long === '--all');

      expect(allOpt).toBeDefined();
    });

    it('should have --dry-run option', () => {
      const command = createTenantCommand();
      const migrate = command.commands.find((c) => c.name() === 'migrate');
      const options = migrate?.options ?? [];
      const dryRunOpt = options.find((o) => o.long === '--dry-run');

      expect(dryRunOpt).toBeDefined();
    });
  });

  describe('tenant:status', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const status = command.commands.find((c) => c.name() === 'status');

      expect(status).toBeDefined();
      expect(status?.description()).toBe('Show tenant status and schema info');
    });

    it('should require slug argument', () => {
      const command = createTenantCommand();
      const status = command.commands.find((c) => c.name() === 'status');
      const args = status?.registeredArguments ?? [];

      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('slug');
      expect(args[0].required).toBe(true);
    });
  });

  describe('tenant:suspend', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const suspend = command.commands.find((c) => c.name() === 'suspend');

      expect(suspend).toBeDefined();
      expect(suspend?.description()).toBe('Suspend a tenant (block access)');
    });

    it('should require slug argument', () => {
      const command = createTenantCommand();
      const suspend = command.commands.find((c) => c.name() === 'suspend');
      const args = suspend?.registeredArguments ?? [];

      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('slug');
      expect(args[0].required).toBe(true);
    });

    it('should have --force option', () => {
      const command = createTenantCommand();
      const suspend = command.commands.find((c) => c.name() === 'suspend');
      const options = suspend?.options ?? [];
      const forceOpt = options.find((o) => o.long === '--force');

      expect(forceOpt).toBeDefined();
      expect(forceOpt?.short).toBe('-f');
    });
  });

  describe('tenant:activate', () => {
    it('should have correct configuration', () => {
      const command = createTenantCommand();
      const activate = command.commands.find((c) => c.name() === 'activate');

      expect(activate).toBeDefined();
      expect(activate?.description()).toBe('Activate a suspended tenant');
    });

    it('should require slug argument', () => {
      const command = createTenantCommand();
      const activate = command.commands.find((c) => c.name() === 'activate');
      const args = activate?.registeredArguments ?? [];

      expect(args.length).toBeGreaterThan(0);
      expect(args[0].name()).toBe('slug');
      expect(args[0].required).toBe(true);
    });

    it('should have --json option', () => {
      const command = createTenantCommand();
      const activate = command.commands.find((c) => c.name() === 'activate');
      const options = activate?.options ?? [];
      const jsonOpt = options.find((o) => o.long === '--json');

      expect(jsonOpt).toBeDefined();
    });
  });
});

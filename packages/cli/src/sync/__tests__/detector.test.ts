/**
 * Sync Detector - Unit Tests
 *
 * Tests for the `detectExisting()` function that scans project directories
 * to discover existing procedure and schema files matching Prisma models.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectExisting } from '../detector.js';
import type { SyncModelInfo } from '../types.js';

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = join(import.meta.dirname ?? __dirname, '__fixtures__', 'detector-tests');

/** Minimal SyncModelInfo stubs for testing */
const MOCK_MODELS: readonly SyncModelInfo[] = [
  {
    name: 'User',
    fields: [],
    relations: [],
    isJoinTable: false,
    hasTimestamps: true,
    uniqueConstraints: [],
  },
  {
    name: 'Post',
    fields: [],
    relations: [],
    isJoinTable: false,
    hasTimestamps: true,
    uniqueConstraints: [],
  },
  {
    name: 'FriendRequest',
    fields: [],
    relations: [],
    isJoinTable: false,
    hasTimestamps: false,
    uniqueConstraints: [],
  },
  {
    name: 'Comment',
    fields: [],
    relations: [],
    isJoinTable: false,
    hasTimestamps: true,
    uniqueConstraints: [],
  },
];

/**
 * Create a project directory with the given file structure.
 * Keys are relative paths; values are file contents.
 */
function createProject(name: string, files: Record<string, string>): string {
  const projectRoot = join(TEST_DIR, name);
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(projectRoot, relativePath);
    const dir = absolutePath.slice(0, absolutePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(absolutePath, content, 'utf-8');
  }
  return projectRoot;
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

// ============================================================================
// Tests
// ============================================================================

describe('detectExisting', () => {
  // --------------------------------------------------------------------------
  // 1. Finds procedure files
  // --------------------------------------------------------------------------
  it('finds procedure files that match model names', () => {
    const root = createProject('find-procedures', {
      'src/procedures/users.ts': '// user procedures',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.size).toBe(1);
    expect(result.procedures.has('User')).toBe(true);
    expect(result.procedures.get('User')).toBe(join(root, 'src', 'procedures', 'users.ts'));
  });

  // --------------------------------------------------------------------------
  // 2. Finds schema files
  // --------------------------------------------------------------------------
  it('finds schema files that match model names', () => {
    const root = createProject('find-schemas', {
      'src/schemas/post.schema.ts': '// post schema',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.schemas.size).toBe(1);
    expect(result.schemas.has('Post')).toBe(true);
    expect(result.schemas.get('Post')).toBe(join(root, 'src', 'schemas', 'post.schema.ts'));
  });

  // --------------------------------------------------------------------------
  // 3. Handles kebab-case filenames
  // --------------------------------------------------------------------------
  it('handles kebab-case filenames', () => {
    const root = createProject('kebab-case', {
      'src/procedures/friend-requests.ts': '// friend request procedures',
      'src/schemas/friend-requests.schema.ts': '// friend request schema',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.has('FriendRequest')).toBe(true);
    expect(result.schemas.has('FriendRequest')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. Handles plural filenames (singularizes)
  // --------------------------------------------------------------------------
  it('handles plural filenames by singularizing', () => {
    const root = createProject('plural-names', {
      'src/procedures/users.ts': '// users -> User',
      'src/schemas/comments.schema.ts': '// comments -> Comment',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.has('User')).toBe(true);
    expect(result.schemas.has('Comment')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Empty project (no src/procedures/ or src/schemas/ dirs)
  // --------------------------------------------------------------------------
  it('returns empty maps when directories do not exist', () => {
    const root = join(TEST_DIR, 'empty-project');
    mkdirSync(root, { recursive: true });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.size).toBe(0);
    expect(result.schemas.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 6. Ignores index.ts and __tests__/ directories
  // --------------------------------------------------------------------------
  it('ignores index.ts and __tests__/ directory entries', () => {
    const root = createProject('ignore-special', {
      'src/procedures/index.ts': '// barrel export',
      'src/procedures/__tests__/foo.ts': '// test file',
      'src/procedures/users.ts': '// valid procedure',
      'src/schemas/index.ts': '// barrel export',
      'src/schemas/__tests__/bar.schema.ts': '// test file',
      'src/schemas/post.schema.ts': '// valid schema',
    });

    const result = detectExisting(root, MOCK_MODELS);

    // Only users.ts should match (index.ts excluded, __tests__/ is a directory so excluded)
    expect(result.procedures.size).toBe(1);
    expect(result.procedures.has('User')).toBe(true);

    // Only post.schema.ts should match
    expect(result.schemas.size).toBe(1);
    expect(result.schemas.has('Post')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 7. Ignores files that don't match any model
  // --------------------------------------------------------------------------
  it('ignores files that do not match any known model', () => {
    const root = createProject('no-match', {
      'src/procedures/widgets.ts': '// no Widget model',
      'src/schemas/gadget.schema.ts': '// no Gadget model',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.size).toBe(0);
    expect(result.schemas.size).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 8. Finds both procedures and schemas together
  // --------------------------------------------------------------------------
  it('detects both procedures and schemas in a full project', () => {
    const root = createProject('full-project', {
      'src/procedures/users.ts': '// user procedures',
      'src/procedures/posts.ts': '// post procedures',
      'src/schemas/user.schema.ts': '// user schema',
      'src/schemas/post.schema.ts': '// post schema',
      'src/schemas/comment.schema.ts': '// comment schema',
    });

    const result = detectExisting(root, MOCK_MODELS);

    expect(result.procedures.size).toBe(2);
    expect(result.procedures.has('User')).toBe(true);
    expect(result.procedures.has('Post')).toBe(true);

    expect(result.schemas.size).toBe(3);
    expect(result.schemas.has('User')).toBe(true);
    expect(result.schemas.has('Post')).toBe(true);
    expect(result.schemas.has('Comment')).toBe(true);
  });
});

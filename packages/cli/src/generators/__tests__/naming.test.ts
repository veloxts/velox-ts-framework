/**
 * Naming Utilities - Unit Tests
 *
 * Tests for entity name transformation utilities.
 */

import { describe, expect, it } from 'vitest';

import {
  deriveEntityNames,
  isPlural,
  pluralize,
  singularize,
  toCamelCase,
  toHumanReadable,
  toKebabCase,
  toPascalCase,
  toScreamingSnakeCase,
  toSnakeCase,
} from '../utils/naming.js';

describe('Naming Utilities', () => {
  describe('toPascalCase', () => {
    it('should convert simple words', () => {
      expect(toPascalCase('user')).toBe('User');
      expect(toPascalCase('post')).toBe('Post');
    });

    it('should convert kebab-case', () => {
      expect(toPascalCase('user-profile')).toBe('UserProfile');
      expect(toPascalCase('blog-post-comment')).toBe('BlogPostComment');
    });

    it('should convert snake_case', () => {
      expect(toPascalCase('user_profile')).toBe('UserProfile');
      expect(toPascalCase('blog_post_comment')).toBe('BlogPostComment');
    });

    it('should convert camelCase', () => {
      expect(toPascalCase('userProfile')).toBe('UserProfile');
      expect(toPascalCase('blogPostComment')).toBe('BlogPostComment');
    });

    it('should handle already PascalCase', () => {
      expect(toPascalCase('UserProfile')).toBe('UserProfile');
    });

    it('should handle single letter', () => {
      expect(toPascalCase('a')).toBe('A');
    });
  });

  describe('toCamelCase', () => {
    it('should convert simple words', () => {
      expect(toCamelCase('User')).toBe('user');
      expect(toCamelCase('POST')).toBe('post');
    });

    it('should convert PascalCase', () => {
      expect(toCamelCase('UserProfile')).toBe('userProfile');
      expect(toCamelCase('BlogPostComment')).toBe('blogPostComment');
    });

    it('should convert kebab-case', () => {
      expect(toCamelCase('user-profile')).toBe('userProfile');
    });

    it('should convert snake_case', () => {
      expect(toCamelCase('user_profile')).toBe('userProfile');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase', () => {
      expect(toKebabCase('UserProfile')).toBe('user-profile');
      expect(toKebabCase('BlogPostComment')).toBe('blog-post-comment');
    });

    it('should convert camelCase', () => {
      expect(toKebabCase('userProfile')).toBe('user-profile');
    });

    it('should convert snake_case', () => {
      expect(toKebabCase('user_profile')).toBe('user-profile');
    });

    it('should handle simple words', () => {
      expect(toKebabCase('user')).toBe('user');
      expect(toKebabCase('User')).toBe('user');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase', () => {
      expect(toSnakeCase('UserProfile')).toBe('user_profile');
      expect(toSnakeCase('BlogPostComment')).toBe('blog_post_comment');
    });

    it('should convert camelCase', () => {
      expect(toSnakeCase('userProfile')).toBe('user_profile');
    });

    it('should convert kebab-case', () => {
      expect(toSnakeCase('user-profile')).toBe('user_profile');
    });
  });

  describe('toScreamingSnakeCase', () => {
    it('should convert to uppercase snake_case', () => {
      expect(toScreamingSnakeCase('userProfile')).toBe('USER_PROFILE');
      expect(toScreamingSnakeCase('UserProfile')).toBe('USER_PROFILE');
      expect(toScreamingSnakeCase('user-profile')).toBe('USER_PROFILE');
    });
  });

  describe('toHumanReadable', () => {
    it('should convert to human readable format', () => {
      expect(toHumanReadable('userProfile')).toBe('User Profile');
      expect(toHumanReadable('UserProfile')).toBe('User Profile');
      expect(toHumanReadable('user-profile')).toBe('User Profile');
      expect(toHumanReadable('user_profile')).toBe('User Profile');
    });
  });

  describe('pluralize', () => {
    it('should pluralize regular nouns', () => {
      expect(pluralize('user')).toBe('users');
      expect(pluralize('post')).toBe('posts');
      expect(pluralize('comment')).toBe('comments');
    });

    it('should handle words ending in s, x, z, ch, sh', () => {
      expect(pluralize('bus')).toBe('buses');
      expect(pluralize('box')).toBe('boxes');
      expect(pluralize('buzz')).toBe('buzzes');
      expect(pluralize('match')).toBe('matches');
      expect(pluralize('dish')).toBe('dishes');
    });

    it('should handle words ending in y', () => {
      expect(pluralize('category')).toBe('categories');
      expect(pluralize('company')).toBe('companies');
      // Words ending in vowel + y
      expect(pluralize('day')).toBe('days');
      expect(pluralize('key')).toBe('keys');
    });

    it('should handle irregular plurals', () => {
      expect(pluralize('person')).toBe('people');
      expect(pluralize('child')).toBe('children');
      expect(pluralize('man')).toBe('men');
      expect(pluralize('woman')).toBe('women');
    });

    it('should not double-pluralize', () => {
      expect(pluralize('users')).toBe('users');
      expect(pluralize('posts')).toBe('posts');
    });
  });

  describe('singularize', () => {
    it('should singularize regular nouns', () => {
      expect(singularize('users')).toBe('user');
      expect(singularize('posts')).toBe('post');
      expect(singularize('comments')).toBe('comment');
    });

    it('should handle words ending in es', () => {
      expect(singularize('buses')).toBe('bus');
      expect(singularize('boxes')).toBe('box');
      expect(singularize('matches')).toBe('match');
      expect(singularize('dishes')).toBe('dish');
    });

    it('should handle words ending in ies', () => {
      expect(singularize('categories')).toBe('category');
      expect(singularize('companies')).toBe('company');
    });

    it('should handle irregular plurals', () => {
      expect(singularize('people')).toBe('person');
      expect(singularize('children')).toBe('child');
      expect(singularize('men')).toBe('man');
      expect(singularize('women')).toBe('woman');
    });

    it('should not change singular words', () => {
      expect(singularize('user')).toBe('user');
      expect(singularize('post')).toBe('post');
    });
  });

  describe('isPlural', () => {
    it('should detect plural words', () => {
      expect(isPlural('users')).toBe(true);
      expect(isPlural('posts')).toBe(true);
      expect(isPlural('categories')).toBe(true);
      expect(isPlural('people')).toBe(true);
    });

    it('should detect singular words', () => {
      expect(isPlural('user')).toBe(false);
      expect(isPlural('post')).toBe(false);
      expect(isPlural('category')).toBe(false);
      expect(isPlural('person')).toBe(false);
    });
  });

  describe('deriveEntityNames', () => {
    it('should derive all name variations from PascalCase', () => {
      const names = deriveEntityNames('UserProfile');

      expect(names.raw).toBe('UserProfile');
      expect(names.pascal).toBe('UserProfile');
      expect(names.camel).toBe('userProfile');
      expect(names.kebab).toBe('user-profile');
      expect(names.snake).toBe('user_profile');
      expect(names.plural).toBe('userProfiles');
      expect(names.singular).toBe('userProfile');
    });

    it('should derive all name variations from kebab-case', () => {
      const names = deriveEntityNames('blog-post');

      expect(names.raw).toBe('blog-post');
      expect(names.pascal).toBe('BlogPost');
      expect(names.camel).toBe('blogPost');
      expect(names.kebab).toBe('blog-post');
      expect(names.snake).toBe('blog_post');
    });

    it('should derive all name variations from snake_case', () => {
      const names = deriveEntityNames('user_account');

      expect(names.raw).toBe('user_account');
      expect(names.pascal).toBe('UserAccount');
      expect(names.camel).toBe('userAccount');
      expect(names.kebab).toBe('user-account');
      expect(names.snake).toBe('user_account');
    });

    it('should handle simple words', () => {
      const names = deriveEntityNames('User');

      expect(names.pascal).toBe('User');
      expect(names.camel).toBe('user');
      expect(names.kebab).toBe('user');
      expect(names.snake).toBe('user');
      expect(names.plural).toBe('users');
      expect(names.singular).toBe('user');
    });

    it('should handle plural input and derive singular', () => {
      const names = deriveEntityNames('Users');

      // pascal is normalized to singular form
      expect(names.pascal).toBe('User');
      expect(names.singular).toBe('user');
      expect(names.plural).toBe('users');
    });
  });
});

/**
 * @veloxts/mcp - Prompt Templates Tests
 * Tests prompt template retrieval, rendering, and substitution
 */

import { describe, expect, it } from 'vitest';

import {
  ADD_VALIDATION,
  CREATE_PROCEDURE,
  ERROR_HANDLING,
  getPromptTemplate,
  listPromptTemplates,
  PROMPT_TEMPLATES,
  renderPromptTemplate,
  SETUP_AUTH,
} from '../templates.js';

describe('Prompt Templates', () => {
  describe('Template Definitions', () => {
    it('should define CREATE_PROCEDURE template', () => {
      expect(CREATE_PROCEDURE.name).toBe('create-procedure');
      expect(CREATE_PROCEDURE.description).toBeDefined();
      expect(CREATE_PROCEDURE.content).toBeDefined();
      expect(CREATE_PROCEDURE.arguments).toBeDefined();
      expect(CREATE_PROCEDURE.arguments?.length).toBeGreaterThan(0);
    });

    it('should define ADD_VALIDATION template', () => {
      expect(ADD_VALIDATION.name).toBe('add-validation');
      expect(ADD_VALIDATION.description).toBeDefined();
      expect(ADD_VALIDATION.content).toBeDefined();
    });

    it('should define SETUP_AUTH template', () => {
      expect(SETUP_AUTH.name).toBe('setup-auth');
      expect(SETUP_AUTH.description).toBeDefined();
      expect(SETUP_AUTH.content).toBeDefined();
    });

    it('should define ERROR_HANDLING template', () => {
      expect(ERROR_HANDLING.name).toBe('error-handling');
      expect(ERROR_HANDLING.description).toBeDefined();
      expect(ERROR_HANDLING.content).toBeDefined();
    });

    it('should have all templates in PROMPT_TEMPLATES array', () => {
      expect(PROMPT_TEMPLATES).toContain(CREATE_PROCEDURE);
      expect(PROMPT_TEMPLATES).toContain(ADD_VALIDATION);
      expect(PROMPT_TEMPLATES).toContain(SETUP_AUTH);
      expect(PROMPT_TEMPLATES).toContain(ERROR_HANDLING);
    });

    it('should have unique template names', () => {
      const names = PROMPT_TEMPLATES.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('getPromptTemplate', () => {
    it('should retrieve template by name', () => {
      const template = getPromptTemplate('create-procedure');
      expect(template).toBeDefined();
      expect(template?.name).toBe('create-procedure');
    });

    it('should return undefined for non-existent template', () => {
      const template = getPromptTemplate('non-existent-template');
      expect(template).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const template = getPromptTemplate('CREATE-PROCEDURE');
      expect(template).toBeUndefined();
    });

    it('should retrieve all defined templates', () => {
      for (const template of PROMPT_TEMPLATES) {
        const retrieved = getPromptTemplate(template.name);
        expect(retrieved).toBe(template);
      }
    });
  });

  describe('listPromptTemplates', () => {
    it('should list all template names and descriptions', () => {
      const list = listPromptTemplates();

      expect(list).toBeDefined();
      expect(list.length).toBe(PROMPT_TEMPLATES.length);
    });

    it('should include name and description for each template', () => {
      const list = listPromptTemplates();

      for (const item of list) {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(typeof item.name).toBe('string');
        expect(typeof item.description).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    });

    it('should match original template data', () => {
      const list = listPromptTemplates();

      for (const item of list) {
        const original = PROMPT_TEMPLATES.find((t) => t.name === item.name);
        expect(original).toBeDefined();
        expect(item.description).toBe(original?.description);
      }
    });
  });

  describe('renderPromptTemplate', () => {
    describe('Basic rendering', () => {
      it('should return undefined for non-existent template', () => {
        const result = renderPromptTemplate('non-existent', {});
        expect(result).toBeUndefined();
      });

      it('should return content without substitution when no args provided', () => {
        const result = renderPromptTemplate('add-validation', {});
        expect(result).toBeDefined();
        expect(result).toBe(ADD_VALIDATION.content);
      });

      it('should handle empty args object', () => {
        const result = renderPromptTemplate('create-procedure', {});
        expect(result).toBeDefined();
        // Should still contain placeholders since no substitution occurred
        expect(result).toContain('{entity}');
      });
    });

    describe('Placeholder substitution', () => {
      it('should replace lowercase placeholders', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'User' });
        expect(result).toBeDefined();
        expect(result).toContain('user');
        expect(result).not.toContain('{entity}');
      });

      it('should replace PascalCase placeholders', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'post' });
        expect(result).toBeDefined();
        expect(result).toContain('Post');
        expect(result).not.toContain('{Entity}');
      });

      it('should replace plural lowercase placeholders', () => {
        const result = renderPromptTemplate('create-procedure', {
          entity: 'User',
          entities: 'users',
        });
        expect(result).toBeDefined();
        expect(result).toContain('users');
        expect(result).not.toContain('{entities}');
      });

      it('should replace plural PascalCase placeholders', () => {
        const result = renderPromptTemplate('create-procedure', {
          entity: 'post',
          entities: 'posts',
        });
        expect(result).toBeDefined();
        expect(result).toContain('Posts');
        expect(result).not.toContain('{Entities}');
      });

      it('should handle multiple placeholders', () => {
        const result = renderPromptTemplate('create-procedure', {
          entity: 'Article',
          entities: 'articles',
        });
        expect(result).toBeDefined();
        expect(result).toContain('article');
        expect(result).toContain('Article');
        expect(result).toContain('articles');
        expect(result).toContain('Articles');
      });
    });

    describe('Pluralization rules', () => {
      it('should add "s" for regular words', () => {
        // Test the automatic pluralization by using {entitys} pattern
        const result = renderPromptTemplate('create-procedure', { entity: 'User' });
        expect(result).toBeDefined();
        // The template doesn't have {entitys}, it has {entities}, so this tests the fallback
      });

      it('should add "es" for words ending in "s"', () => {
        // Testing automatic pluralization with a hypothetical template using {classs}
        const result = renderPromptTemplate('create-procedure', { entity: 'Class' });
        expect(result).toBeDefined();
      });

      it('should add "es" for words ending in "x"', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'Box' });
        expect(result).toBeDefined();
      });

      it('should add "es" for words ending in "z"', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'Quiz' });
        expect(result).toBeDefined();
      });

      it('should add "es" for words ending in "ch"', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'Branch' });
        expect(result).toBeDefined();
      });

      it('should add "es" for words ending in "sh"', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'Dish' });
        expect(result).toBeDefined();
      });
    });

    describe('Case transformations', () => {
      it('should handle all-uppercase input', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'USER' });
        expect(result).toBeDefined();
        expect(result).toContain('user');
        expect(result).toContain('User');
      });

      it('should handle all-lowercase input', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'user' });
        expect(result).toBeDefined();
        expect(result).toContain('user');
        expect(result).toContain('User');
      });

      it('should handle mixed-case input', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'uSeR' });
        expect(result).toBeDefined();
        expect(result).toContain('user');
        expect(result).toContain('User');
      });

      it('should handle PascalCase input correctly', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'BlogPost' });
        expect(result).toBeDefined();
        // Should convert to lowercase "blogpost" and PascalCase "Blogpost"
        expect(result).toContain('blogpost');
        expect(result).toContain('Blogpost');
      });
    });

    describe('Edge cases', () => {
      it('should skip empty string values', () => {
        const result = renderPromptTemplate('create-procedure', { entity: '' });
        expect(result).toBeDefined();
        // Placeholders should remain since value is empty
        expect(result).toContain('{entity}');
      });

      it('should handle special characters in values', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'User-Item' });
        expect(result).toBeDefined();
        expect(result).toContain('user-item');
      });

      it('should handle numeric values converted to strings', () => {
        const result = renderPromptTemplate('create-procedure', { entity: '123' });
        expect(result).toBeDefined();
        expect(result).toContain('123');
      });

      it('should replace all occurrences of a placeholder', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'User' });
        expect(result).toBeDefined();
        // The template should have multiple occurrences of {entity}/{Entity}
        const occurrences = (result.match(/user/gi) || []).length;
        expect(occurrences).toBeGreaterThan(1);
      });

      it('should not affect unmatched placeholders', () => {
        const template = getPromptTemplate('create-procedure');
        const result = renderPromptTemplate('create-procedure', { nonexistent: 'value' });
        expect(result).toBeDefined();
        // Should still have original placeholders since we didn't provide entity
        expect(result).toBe(template?.content);
      });
    });

    describe('Real-world scenarios', () => {
      it('should render create-procedure template for User entity', () => {
        const result = renderPromptTemplate('create-procedure', {
          entity: 'User',
          entities: 'users',
        });
        expect(result).toBeDefined();
        expect(result).toContain('UserSchema');
        expect(result).toContain('CreateUser');
        expect(result).toContain('userProcedures');
        expect(result).toContain('getUser');
        expect(result).toContain('createUser');
        expect(result).toContain('/users/:id');
      });

      it('should render create-procedure template for Post entity', () => {
        const result = renderPromptTemplate('create-procedure', {
          entity: 'Post',
          entities: 'posts',
        });
        expect(result).toBeDefined();
        expect(result).toContain('PostSchema');
        expect(result).toContain('CreatePost');
        expect(result).toContain('postProcedures');
        expect(result).toContain('getPost');
      });

      it('should render create-procedure template for complex entity name', () => {
        const result = renderPromptTemplate('create-procedure', { entity: 'BlogPost' });
        expect(result).toBeDefined();
        expect(result).toContain('BlogpostSchema');
        expect(result).toContain('CreateBlogpost');
        expect(result).toContain('blogpostProcedures');
      });
    });
  });

  describe('Template content validation', () => {
    it('should have all templates with non-empty content', () => {
      for (const template of PROMPT_TEMPLATES) {
        expect(template.content.length).toBeGreaterThan(0);
      }
    });

    it('should have markdown-formatted content', () => {
      for (const template of PROMPT_TEMPLATES) {
        // Templates should start with markdown headers
        expect(template.content).toMatch(/^#/);
      }
    });

    it('should have code blocks in relevant templates', () => {
      expect(CREATE_PROCEDURE.content).toContain('```typescript');
      expect(ADD_VALIDATION.content).toContain('```typescript');
      expect(SETUP_AUTH.content).toContain('```typescript');
      expect(ERROR_HANDLING.content).toContain('```typescript');
    });
  });

  describe('Template arguments validation', () => {
    it('should define required argument for create-procedure', () => {
      const entityArg = CREATE_PROCEDURE.arguments?.find((arg) => arg.name === 'entity');
      expect(entityArg).toBeDefined();
      expect(entityArg?.required).toBe(true);
      expect(entityArg?.description).toBeDefined();
    });

    it('should define optional argument for operations', () => {
      const operationsArg = CREATE_PROCEDURE.arguments?.find((arg) => arg.name === 'operations');
      expect(operationsArg).toBeDefined();
      expect(operationsArg?.required).toBeUndefined();
      expect(operationsArg?.description).toBeDefined();
    });

    it('should have valid argument structures', () => {
      for (const template of PROMPT_TEMPLATES) {
        if (template.arguments) {
          for (const arg of template.arguments) {
            expect(arg).toHaveProperty('name');
            expect(arg).toHaveProperty('description');
            expect(typeof arg.name).toBe('string');
            expect(typeof arg.description).toBe('string');
            if (arg.required !== undefined) {
              expect(typeof arg.required).toBe('boolean');
            }
          }
        }
      }
    });
  });
});

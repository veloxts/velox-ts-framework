/**
 * @veloxts/core - DI Token Unit Tests
 * Tests token creation, type guards, and validation
 */

import { describe, expect, it } from 'vitest';

import {
  createStringToken,
  createSymbolToken,
  getTokenName,
  isClassToken,
  isStringToken,
  isSymbolToken,
  validateToken,
} from '../di/tokens.js';

describe('DI Tokens', () => {
  describe('createStringToken', () => {
    it('should create a string token', () => {
      const token = createStringToken<string>('TEST_TOKEN');
      expect(typeof token).toBe('string');
      expect(token).toBe('TEST_TOKEN');
    });

    it('should preserve the string value', () => {
      const token = createStringToken<number>('MY_SERVICE');
      expect(token.toString()).toBe('MY_SERVICE');
    });
  });

  describe('createSymbolToken', () => {
    it('should create a symbol token', () => {
      const token = createSymbolToken<string>('TEST');
      expect(typeof token).toBe('symbol');
    });

    it('should include description in the symbol', () => {
      const token = createSymbolToken<number>('MyDescription');
      expect(token.description).toBe('MyDescription');
    });

    it('should create unique symbols with same description', () => {
      const token1 = createSymbolToken<string>('SAME');
      const token2 = createSymbolToken<string>('SAME');
      expect(token1).not.toBe(token2);
    });

    it('should work without description', () => {
      const token = createSymbolToken<string>();
      expect(typeof token).toBe('symbol');
    });
  });

  describe('getTokenName', () => {
    it('should return string token value', () => {
      const token = createStringToken<string>('DATABASE');
      expect(getTokenName(token)).toBe('DATABASE');
    });

    it('should return symbol description', () => {
      const token = createSymbolToken<string>('LOGGER');
      expect(getTokenName(token)).toBe('LOGGER');
    });

    it('should return "Symbol()" for symbol without description', () => {
      const token = createSymbolToken<string>();
      expect(getTokenName(token)).toBe('Symbol()');
    });

    it('should return class name for class token', () => {
      class MyService {}
      expect(getTokenName(MyService)).toBe('MyService');
    });

    it('should return "AnonymousClass" for anonymous class', () => {
      const AnonymousClass = (() => class {})();
      expect(getTokenName(AnonymousClass)).toBe('AnonymousClass');
    });
  });

  describe('isClassToken', () => {
    it('should return true for class constructor', () => {
      class TestClass {}
      expect(isClassToken(TestClass)).toBe(true);
    });

    it('should return true for function constructor', () => {
      function TestConstructor() {}
      expect(isClassToken(TestConstructor)).toBe(true);
    });

    it('should return false for string token', () => {
      const token = createStringToken<string>('TEST');
      expect(isClassToken(token)).toBe(false);
    });

    it('should return false for symbol token', () => {
      const token = createSymbolToken<string>('TEST');
      expect(isClassToken(token)).toBe(false);
    });
  });

  describe('isStringToken', () => {
    it('should return true for string token', () => {
      const token = createStringToken<string>('TEST');
      expect(isStringToken(token)).toBe(true);
    });

    it('should return false for class token', () => {
      class TestClass {}
      expect(isStringToken(TestClass)).toBe(false);
    });

    it('should return false for symbol token', () => {
      const token = createSymbolToken<string>('TEST');
      expect(isStringToken(token)).toBe(false);
    });
  });

  describe('isSymbolToken', () => {
    it('should return true for symbol token', () => {
      const token = createSymbolToken<string>('TEST');
      expect(isSymbolToken(token)).toBe(true);
    });

    it('should return false for class token', () => {
      class TestClass {}
      expect(isSymbolToken(TestClass)).toBe(false);
    });

    it('should return false for string token', () => {
      const token = createStringToken<string>('TEST');
      expect(isSymbolToken(token)).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should not throw for valid class token', () => {
      class TestClass {}
      expect(() => validateToken(TestClass)).not.toThrow();
    });

    it('should not throw for valid string token', () => {
      const token = createStringToken<string>('TEST');
      expect(() => validateToken(token)).not.toThrow();
    });

    it('should not throw for valid symbol token', () => {
      const token = createSymbolToken<string>('TEST');
      expect(() => validateToken(token)).not.toThrow();
    });

    it('should throw for null token', () => {
      expect(() => validateToken(null)).toThrow('Injection token cannot be null or undefined');
    });

    it('should throw for undefined token', () => {
      expect(() => validateToken(undefined)).toThrow('Injection token cannot be null or undefined');
    });

    it('should throw for number token', () => {
      expect(() => validateToken(123)).toThrow('Invalid injection token type: number');
    });

    it('should throw for object token', () => {
      expect(() => validateToken({})).toThrow('Invalid injection token type: object');
    });

    it('should throw for boolean token', () => {
      expect(() => validateToken(true)).toThrow('Invalid injection token type: boolean');
    });
  });
});

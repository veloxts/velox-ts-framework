/**
 * Storage Utilities Tests
 */

import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  basename,
  detectMimeType,
  dirname,
  extname,
  formatBytes,
  isReadableStream,
  joinPath,
  normalizePath,
  streamToBuffer,
  toBuffer,
  uniqueFileName,
  validatePath,
} from '../utils.js';

describe('normalizePath', () => {
  it('should remove leading slashes', () => {
    expect(normalizePath('/path/to/file')).toBe('path/to/file');
    expect(normalizePath('///path/to/file')).toBe('path/to/file');
  });

  it('should remove trailing slashes', () => {
    expect(normalizePath('path/to/file/')).toBe('path/to/file');
    expect(normalizePath('path/to/file///')).toBe('path/to/file');
  });

  it('should collapse multiple slashes', () => {
    expect(normalizePath('path//to///file')).toBe('path/to/file');
  });

  it('should handle already normalized paths', () => {
    expect(normalizePath('path/to/file')).toBe('path/to/file');
  });

  it('should handle simple file names', () => {
    expect(normalizePath('file.txt')).toBe('file.txt');
  });
});

describe('joinPath', () => {
  it('should join path segments', () => {
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c');
  });

  it('should filter empty segments', () => {
    expect(joinPath('a', '', 'b', '', 'c')).toBe('a/b/c');
  });

  it('should normalize the result', () => {
    expect(joinPath('/a/', '/b/', '/c/')).toBe('a/b/c');
  });

  it('should handle single segment', () => {
    expect(joinPath('file.txt')).toBe('file.txt');
  });
});

describe('dirname', () => {
  it('should return directory name', () => {
    expect(dirname('path/to/file.txt')).toBe('path/to');
  });

  it('should return empty string for root-level file', () => {
    expect(dirname('file.txt')).toBe('');
  });

  it('should handle normalized input', () => {
    expect(dirname('/path/to/file.txt')).toBe('path/to');
  });
});

describe('basename', () => {
  it('should return file name', () => {
    expect(basename('path/to/file.txt')).toBe('file.txt');
  });

  it('should handle root-level file', () => {
    expect(basename('file.txt')).toBe('file.txt');
  });

  it('should handle normalized input', () => {
    expect(basename('/path/to/file.txt')).toBe('file.txt');
  });
});

describe('extname', () => {
  it('should return file extension', () => {
    expect(extname('file.txt')).toBe('txt');
    expect(extname('image.jpg')).toBe('jpg');
    expect(extname('archive.tar.gz')).toBe('gz');
  });

  it('should return empty string for no extension', () => {
    expect(extname('file')).toBe('');
    expect(extname('path/to/file')).toBe('');
  });

  it('should handle dotfiles', () => {
    expect(extname('.gitignore')).toBe('');
    expect(extname('.env.local')).toBe('local');
  });
});

describe('detectMimeType', () => {
  it('should detect common MIME types', () => {
    expect(detectMimeType('file.txt')).toBe('text/plain');
    expect(detectMimeType('image.jpg')).toBe('image/jpeg');
    expect(detectMimeType('image.png')).toBe('image/png');
    expect(detectMimeType('document.pdf')).toBe('application/pdf');
    expect(detectMimeType('data.json')).toBe('application/json');
    expect(detectMimeType('style.css')).toBe('text/css');
    // Note: text/javascript is the IANA standard, application/javascript is also valid
    expect(detectMimeType('script.js')).toBe('text/javascript');
  });

  it('should return application/octet-stream for unknown types', () => {
    expect(detectMimeType('file.unknown')).toBe('application/octet-stream');
    expect(detectMimeType('file')).toBe('application/octet-stream');
  });
});

describe('toBuffer', () => {
  it('should return buffer as-is', () => {
    const buf = Buffer.from('Hello');
    expect(toBuffer(buf)).toBe(buf);
  });

  it('should convert string to buffer', () => {
    const result = toBuffer('Hello');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('Hello');
  });
});

describe('isReadableStream', () => {
  it('should return true for readable streams', () => {
    const stream = Readable.from(['Hello']);
    expect(isReadableStream(stream)).toBe(true);
  });

  it('should return false for buffers', () => {
    expect(isReadableStream(Buffer.from('Hello'))).toBe(false);
  });

  it('should return false for strings', () => {
    expect(isReadableStream('Hello')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isReadableStream(null)).toBe(false);
  });

  it('should return false for objects without pipe', () => {
    expect(isReadableStream({ data: 'test' })).toBe(false);
  });
});

describe('streamToBuffer', () => {
  it('should convert stream to buffer', async () => {
    const stream = Readable.from(['Hello, ', 'World!']);
    const buffer = await streamToBuffer(stream);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('Hello, World!');
  });

  it('should handle empty stream', async () => {
    const stream = Readable.from([]);
    const buffer = await streamToBuffer(stream);

    expect(buffer.length).toBe(0);
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });
});

describe('validatePath', () => {
  it('should accept valid paths', () => {
    expect(() => validatePath('file.txt')).not.toThrow();
    expect(() => validatePath('path/to/file.txt')).not.toThrow();
    expect(() => validatePath('uploads/2024/01/image.jpg')).not.toThrow();
  });

  it('should reject path traversal', () => {
    expect(() => validatePath('../escape')).toThrow('path traversal');
    expect(() => validatePath('path/../escape')).toThrow('path traversal');
    expect(() => validatePath('path/to/../../escape')).toThrow('path traversal');
  });

  it('should reject null bytes', () => {
    expect(() => validatePath('file\0name')).toThrow('null byte');
  });

  it('should reject empty paths', () => {
    expect(() => validatePath('')).toThrow('cannot be empty');
  });
});

describe('uniqueFileName', () => {
  it('should generate unique file names', () => {
    const name1 = uniqueFileName('document.pdf');
    const name2 = uniqueFileName('document.pdf');

    expect(name1).toMatch(/^document-\d+-[a-z0-9]+\.pdf$/);
    expect(name1).not.toBe(name2);
  });

  it('should preserve extension', () => {
    expect(uniqueFileName('image.jpg')).toMatch(/\.jpg$/);
    expect(uniqueFileName('archive.tar.gz')).toMatch(/\.gz$/);
  });

  it('should handle files without extension', () => {
    const name = uniqueFileName('README');
    expect(name).toMatch(/^README-\d+-[a-z0-9]+$/);
    expect(name).not.toContain('.');
  });
});

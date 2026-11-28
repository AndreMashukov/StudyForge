import { describe, expect, it } from 'vitest';
import {
  isDataCodeLanguage,
  speakCodeBlock,
  speakInlineCode,
  speakOpaqueStrings,
  splitIdentifier,
  spokenCodeLanguage,
} from './narration-speech';

// Built at runtime so secret scanners do not mistake the fixture for a real key.
const FAKE_KEY = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_');

describe('speakOpaqueStrings', () => {
  it.each([
    ['id 3f2a9c1e-7b4d-4e2a-9c1e-0a1b2c3d4e5f here', 'id a UUID here'],
    [
      'send eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc_DEF-123 now',
      'send a token now',
    ],
    ['commit 85a1b7a1 fixed it', 'commit a hash fixed it'],
    [
      'sha e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'sha a hash',
    ],
    ['pointer 0x7ffde4a1b2c3', 'pointer a hash'],
    [`key ${FAKE_KEY}`, 'key a key'],
    ['blob aGVsbG8gV29ybGQ1MjM0NTY3ODkw==', 'blob a key'],
    ['at 1732838400000 ms', 'at a long number ms'],
    ['See https://github.com/org/repo/pull/12.', 'See a link to github.com.'],
    ['Go to https://www.example.com', 'Go to a link to example.com'],
  ])('%s', (input, spoken) => {
    expect(speakOpaqueStrings(input)).toBe(spoken);
  });

  it.each([
    'A deadbeef and a facade are words.',
    'Version v1.2.3 shipped in 2026.',
    'Call 0xFF or 12345678.',
    'The getUserByIdAndOrganization handler.',
    'Use state-of-the-art tooling.',
    '50% of users at 10/12 sites.',
  ])('leaves ordinary text alone: %s', (input) => {
    expect(speakOpaqueStrings(input)).toBe(input);
  });
});

describe('splitIdentifier', () => {
  it.each([
    ['getUserById', 'get user by id'],
    ['user_name', 'user name'],
    ['MAX_RETRIES', 'max retries'],
    ['HTTPServer', 'HTTP server'],
    ['userID', 'user ID'],
    ['__init__', 'init'],
  ])('%s → %s', (identifier, spoken) => {
    expect(splitIdentifier(identifier)).toBe(spoken);
  });
});

describe('speakCodeBlock', () => {
  it('reads one sentence per line with symbols as words', () => {
    expect(
      speakCodeBlock(
        [
          'function retry(attempts) {',
          '  if (attempts >= 3 && !force) return null;',
          '  const next = attempts + 1;',
          '  return user.profile?.name;',
          '}',
        ].join('\n'),
      ),
    ).toEqual([
      'function retry attempts.',
      'if attempts at least 3 and not force return null.',
      'const next equals attempts plus 1.',
      'return user dot profile dot name.',
    ]);
  });

  it('reads comparison and arrow operators', () => {
    expect(
      speakCodeBlock(
        'a === b\na !== b\nx < y\nconst f = (n) => n * 2\nx += 1\ni++',
      ),
    ).toEqual([
      'a equals b.',
      'a not equal to b.',
      'x less than y.',
      'const f equals n returns n times 2.',
      'x plus equals 1.',
      'i plus plus.',
    ]);
  });

  it('drops angle brackets of generics and tags', () => {
    expect(speakCodeBlock('const list: Array<string> = []')).toEqual([
      'const list array string equals.',
    ]);
  });

  it('reads comments as prose, in their own sentence', () => {
    expect(
      speakCodeBlock(
        [
          '// Retry three times.',
          'x = 1  # the default',
          '/**',
          ' * Loads the user.',
          ' * @param id the user id',
          ' */',
          '-- SQL comment',
        ].join('\n'),
      ),
    ).toEqual([
      'Retry three times.',
      'x equals 1.',
      'the default.',
      'Loads the user.',
      'param id the user id.',
      'SQL comment.',
    ]);
  });

  it('reads string literals by their contents', () => {
    expect(
      speakCodeBlock(
        'print("Hello, world!")\nfetch(\'/api/users/3f2a9c1e-7b4d-4e2a-9c1e-0a1b2c3d4e5f/docs\')',
      ),
    ).toEqual(['print Hello, world!', 'fetch api, users, a UUID, docs.']);
  });

  it('replaces opaque strings and keeps URL hosts', () => {
    expect(
      speakCodeBlock(
        `const key = "${FAKE_KEY}"\nconst url = "https://api.stripe.com/v1/charges"\ncheckout 85a1b7a1`,
      ),
    ).toEqual([
      'const key equals a key.',
      'const url equals a link to api.stripe.com.',
      'checkout a hash.',
    ]);
  });

  it('reads minus signs and kebab-case', () => {
    expect(
      speakCodeBlock('x = -1\ny = a - b\nnpm run build-web --force'),
    ).toEqual([
      'x equals minus 1.',
      'y equals a minus b.',
      'npm run build web force.',
    ]);
  });

  it('keeps preprocessor lines as code and drops a shebang', () => {
    expect(
      speakCodeBlock('#!/usr/bin/env bash\n#include <stdio.h>\necho done'),
    ).toEqual(['include stdio dot h.', 'echo done.']);
  });

  it('leaves out lines with nothing to say', () => {
    expect(speakCodeBlock('{\n  });\n\n]')).toEqual([]);
  });
});

describe('speakInlineCode', () => {
  it('reads inline code without adding pauses', () => {
    expect(speakInlineCode('getUserById()')).toBe('get user by id');
    expect(speakInlineCode('user.id')).toBe('user dot id');
    expect(speakInlineCode('npm install')).toBe('npm install');
  });
});

describe('code languages', () => {
  it('names known languages and marks data', () => {
    expect(spokenCodeLanguage('ts')).toBe('TypeScript');
    expect(spokenCodeLanguage('PY')).toBe('Python');
    expect(spokenCodeLanguage('elixir')).toBeUndefined();
    expect(spokenCodeLanguage(undefined)).toBeUndefined();
    expect(isDataCodeLanguage('json')).toBe(true);
    expect(isDataCodeLanguage('yml')).toBe(true);
    expect(isDataCodeLanguage('ts')).toBe(false);
    expect(isDataCodeLanguage(undefined)).toBe(false);
  });
});

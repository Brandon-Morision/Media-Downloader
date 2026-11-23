import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseBatchUrls } from './parseBatchUrls.js';

describe('parseBatchUrls', () => {
  test('handles empty and whitespace-only input', () => {
    assert.deepEqual(parseBatchUrls(''), {
      validUrls: [],
      invalidLines: [],
      duplicates: [],
      totalLines: 0,
      blankLines: 0,
      commentLines: 0,
    });

    const onlySpaces = parseBatchUrls('   \n  \t  \r\n');
    assert.equal(onlySpaces.validUrls.length, 0);
    assert.equal(onlySpaces.blankLines, 3);
  });

  test('parses clean valid HTTP and HTTPS URLs', () => {
    const input = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'http://example.com/audio.mp3',
      'https://soundcloud.com/artist/track',
    ].join('\n');

    const result = parseBatchUrls(input);
    assert.equal(result.validUrls.length, 3);
    assert.equal(result.invalidLines.length, 0);
    assert.equal(result.duplicates.length, 0);
    assert.equal(result.validUrls[0], 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(result.validUrls[1], 'http://example.com/audio.mp3');
  });

  test('normalizes URLs without protocol scheme and trims whitespace', () => {
    const input = '   youtube.com/watch?v=abc   \n\t  bandcamp.com/album/track  ';
    const result = parseBatchUrls(input);
    assert.deepEqual(result.validUrls, [
      'https://youtube.com/watch?v=abc',
      'https://bandcamp.com/album/track',
    ]);
    assert.equal(result.invalidLines.length, 0);
  });

  test('handles CRLF line endings identically to LF', () => {
    const crlfInput = 'https://site.com/1\r\nhttps://site.com/2\r\nhttps://site.com/3';
    const lfInput = 'https://site.com/1\nhttps://site.com/2\nhttps://site.com/3';

    const crlfResult = parseBatchUrls(crlfInput);
    const lfResult = parseBatchUrls(lfInput);

    assert.deepEqual(crlfResult.validUrls, lfResult.validUrls);
    assert.equal(crlfResult.validUrls.length, 3);
  });

  test('ignores comment lines starting with #', () => {
    const input = [
      '# Download list for project',
      'https://vimeo.com/123456',
      '   # another comment with leading spaces',
      'https://vimeo.com/789012',
    ].join('\n');

    const result = parseBatchUrls(input);
    assert.equal(result.validUrls.length, 2);
    assert.equal(result.commentLines, 2);
  });

  test('identifies and deduplicates duplicate URLs', () => {
    const input = [
      'https://youtube.com/watch?v=test',
      'https://vimeo.com/999',
      'https://youtube.com/watch?v=test', // duplicate
      '   youtube.com/watch?v=test  ',   // duplicate after normalize
      'https://soundcloud.com/test',
    ].join('\n');

    const result = parseBatchUrls(input);
    assert.equal(result.validUrls.length, 3);
    assert.equal(result.duplicates.length, 2);
    assert.equal(result.duplicates[0].line, 3);
    assert.equal(result.duplicates[1].line, 4);
  });

  test('respects dedupe: false option', () => {
    const input = 'https://example.com/1\nhttps://example.com/1';
    const result = parseBatchUrls(input, { dedupe: false });
    assert.equal(result.validUrls.length, 2);
    assert.equal(result.duplicates.length, 0);
  });

  test('flags invalid schemes such as ftp, file, and javascript', () => {
    const input = [
      'ftp://ftp.example.com/file.zip',
      'file:///C:/secrets.txt',
      'javascript:alert(1)',
      'https://legit.com/video',
    ].join('\n');

    const result = parseBatchUrls(input);
    assert.equal(result.validUrls.length, 1);
    assert.equal(result.validUrls[0], 'https://legit.com/video');
    assert.equal(result.invalidLines.length, 3);
    assert.equal(result.invalidLines[0].line, 1);
    assert.match(result.invalidLines[0].error, /Unsupported scheme/i);
    assert.equal(result.invalidLines[1].line, 2);
    assert.match(result.invalidLines[1].error, /Unsupported scheme/i);
  });

  test('flags malformed or non-URL text', () => {
    const input = [
      'just a regular sentence',
      'not a url at all',
      'http://',
      'https://',
      'valid.org/path',
    ].join('\n');

    const result = parseBatchUrls(input);
    assert.equal(result.validUrls.length, 1);
    assert.equal(result.validUrls[0], 'https://valid.org/path');
    assert.equal(result.invalidLines.length, 4);
  });

  test('processes very long lists (5,000 lines) quickly and without errors', () => {
    const lines = [];
    for (let i = 0; i < 5000; i++) {
      if (i % 47 === 0) {
        lines.push('not-a-valid-url');
      } else if (i % 10 === 0) {
        lines.push(''); // blank
      } else if (i % 25 === 0) {
        lines.push('# comment line');
      } else if (i % 5 === 0) {
        lines.push('https://example.com/item-shared'); // duplicates
      } else {
        lines.push(`https://example.com/item-${i}`);
      }
    }
    const bigInput = lines.join('\n');

    const start = performance.now();
    const result = parseBatchUrls(bigInput);
    const duration = performance.now() - start;

    assert.ok(duration < 500, `Execution took ${duration.toFixed(2)}ms, expected < 500ms`);
    assert.ok(result.validUrls.length > 3500);
    assert.ok(result.duplicates.length > 0);
    assert.ok(result.invalidLines.length > 0);
    assert.ok(result.blankLines > 0);
  });
});

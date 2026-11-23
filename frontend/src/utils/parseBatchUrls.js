/**
 * Utility to parse and validate batch URL text input.
 */

const HTTP_SCHEME_RE = /^https?:\/\//i;
const HAS_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const DOMAIN_PATH_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i;

/**
 * Checks if a string looks like a valid web URL or domain.
 * @param {string} text
 * @returns {boolean}
 */
export function isLikelyUrl(text) {
  const s = (text || '').trim();
  if (!s || /\s/.test(s)) return false;
  if (HTTP_SCHEME_RE.test(s)) return true;
  return DOMAIN_PATH_RE.test(s);
}

/**
 * Normalizes URL string, prepending https:// if missing scheme.
 * @param {string} text
 * @returns {string}
 */
export function normalizeUrl(text) {
  const s = (text || '').trim();
  return HTTP_SCHEME_RE.test(s) ? s : `https://${s}`;
}

/**
 * Parses raw batch text (newline-delimited) into valid URLs, invalid entries, and duplicates.
 *
 * @param {string} text - Raw input text from textarea or file
 * @param {object} [options]
 * @param {boolean} [options.dedupe=true] - Whether to deduplicate valid URLs
 * @returns {{
 *   validUrls: string[],
 *   invalidLines: Array<{ line: number, text: string, error: string }>,
 *   duplicates: Array<{ line: number, url: string }>,
 *   totalLines: number,
 *   blankLines: number,
 *   commentLines: number,
 * }}
 */
export function parseBatchUrls(text, options = {}) {
  const { dedupe = true } = options;
  if (!text || typeof text !== 'string') {
    return {
      validUrls: [],
      invalidLines: [],
      duplicates: [],
      totalLines: 0,
      blankLines: 0,
      commentLines: 0,
    };
  }

  const rawLines = text.split(/\r?\n/);
  const totalLines = rawLines.length;

  const validUrls = [];
  const invalidLines = [];
  const duplicates = [];
  const seenUrls = new Set();
  let blankLines = 0;
  let commentLines = 0;

  rawLines.forEach((rawLine, index) => {
    const lineNum = index + 1;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      blankLines++;
      return;
    }

    if (trimmed.startsWith('#')) {
      commentLines++;
      return;
    }

    // Check for explicit non-http schemes (e.g. ftp://, file://, javascript:)
    if (HAS_SCHEME_RE.test(trimmed) && !HTTP_SCHEME_RE.test(trimmed)) {
      invalidLines.push({
        line: lineNum,
        text: trimmed,
        error: 'Unsupported scheme (only http:// and https:// supported)',
      });
      return;
    }

    if (!isLikelyUrl(trimmed)) {
      invalidLines.push({
        line: lineNum,
        text: trimmed,
        error: 'Invalid URL format',
      });
      return;
    }

    const normalized = normalizeUrl(trimmed);

    // Validate with URL constructor
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        invalidLines.push({
          line: lineNum,
          text: trimmed,
          error: `Unsupported protocol: ${parsed.protocol}`,
        });
        return;
      }
    } catch {
      invalidLines.push({
        line: lineNum,
        text: trimmed,
        error: 'Malformed URL',
      });
      return;
    }

    if (dedupe && seenUrls.has(normalized)) {
      duplicates.push({ line: lineNum, url: normalized });
    } else {
      seenUrls.add(normalized);
      validUrls.push(normalized);
    }
  });

  return {
    validUrls,
    invalidLines,
    duplicates,
    totalLines,
    blankLines,
    commentLines,
  };
}

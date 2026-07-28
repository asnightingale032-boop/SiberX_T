// Minimal CSP violation report collector (Security Recommendation,
// Dimension 11: Attack-Surface Simplicity — "Add CSP violation reporting
// so new code that would violate the policy is surfaced during
// development instead of failing silently.")
//
// This is the ONE deliberate, minimal exception to this project's
// "zero backend" design: a single stateless endpoint that only accepts a
// browser's own CSP violation reports and logs them to Vercel's function
// log viewer. It:
//   - accepts no other input, has no query parameters it reads, and
//     performs no redirect based on request data (see REDIR-01)
//   - stores nothing (no database, no file writes, no localStorage)
//   - returns no data back to the caller beyond a status code
//   - never echoes request content back into a response body
// Logs are visible only to the project owner via the Vercel dashboard —
// nothing here is publicly readable.
//
// Hardened per External_Vulnerability_Assessment_SiberX_T_Ikenna_Daniel
// (finding EXT-02, "CSP report endpoint lacks explicit abuse controls"):
// this endpoint previously accepted any content type and any body size
// with no bound before logging. It now:
//   1. only accepts the content types a real CSP report can arrive as
//   2. rejects oversized bodies via Content-Length before doing any work
//   3. strips control/newline characters from whatever gets logged, so a
//      crafted report body can't inject fake extra log lines
//   4. caps the logged size regardless of the above (defense in depth)
//
// What this endpoint deliberately does NOT do: real per-IP rate
// limiting. A single stateless serverless function has no shared counter
// to enforce that correctly (an in-memory counter would reset on every
// cold start and wouldn't be shared across concurrent instances) —
// implementing it properly needs either a real datastore (which this
// project intentionally doesn't have) or a platform-level control.
// Vercel's own Attack Challenge Mode / Firewall (Project Settings →
// Firewall) is the correct place for that and is a one-click enable, not
// a code change. If actual abuse is ever observed in the Vercel function
// logs, enable that, or disable/sample this endpoint (RELEASE_CHECKLIST.md
// has a reminder to reassess whether CSP reporting is still needed).
//
// CommonJS export (not ESM) deliberately, so this runs on Vercel's
// default Node.js function runtime without requiring "type": "module"
// in package.json.

const ALLOWED_CONTENT_TYPES = [
  'application/csp-report',   // legacy report-uri format
  'application/reports+json', // modern Reporting API format
  'application/json',         // some browsers send CSP reports as plain JSON
];
const MAX_BODY_BYTES = 8192;  // generous for a CSP report; anything bigger is rejected outright
const MAX_LOG_CHARS = 4000;   // separate, smaller cap on what actually gets logged

function stripControlChars(str) {
  // Same defensive technique as sanitizeText() in assets/js/app.js:
  // remove characters that could be used to inject fake extra log lines
  // or otherwise confuse a log viewer/parser, without altering the
  // legibility of normal report content.
  return String(str).replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
}

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    res.status(415).json({ error: 'Unsupported content type' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  try {
    // req.body may be a parsed object (application/json), a string, or a
    // Buffer depending on the content type and Vercel's body parser —
    // normalize all three to a single-line, size-capped, control-
    // character-free string before it ever reaches the log.
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const safeLine = stripControlChars(raw).slice(0, MAX_LOG_CHARS);
    console.log('[CSP Violation Report]', safeLine);
  } catch (e) {
    console.log('[CSP Violation Report] received (unparseable body)');
  }
  res.status(204).end();
};

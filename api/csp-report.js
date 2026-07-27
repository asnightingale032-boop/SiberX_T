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
//   - returns no data back to the caller beyond a 204/405 status
//   - never echoes request content back into a response body
// Logs are visible only to the project owner via the Vercel dashboard —
// nothing here is publicly readable.
//
// CommonJS export (not ESM) deliberately, so this runs on Vercel's
// default Node.js function runtime without requiring "type": "module"
// in package.json.
module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // req.body may be either the modern "reporting-api" array format or
    // the legacy report-uri single-object format, depending on browser.
    console.log('[CSP Violation Report]', JSON.stringify(req.body).slice(0, 4000));
  } catch (e) {
    console.log('[CSP Violation Report] received (unparseable body)');
  }
  res.status(204).end();
};

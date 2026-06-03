// ── Admin configuration ─────────────────────────────────────────────────────
// REQUIRED_EMAIL_VALUE : the email must include this string (e.g. '@desc.org')
// ACCESS_CODE_HASH     : SHA-256 hex digest of the access code
//   Generate a new hash in the browser console:
//     crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-code'))
//       .then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''))
// SESSION_TTL_HOURS    : hours before the login session expires
//
// Default access code is "1234" — change it before deploying.
export const REQUIRED_EMAIL_VALUE = '@desc.org';
export const ACCESS_CODE_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // "1234"
export const SESSION_TTL_HOURS = 24;
export const GITHUB_OWNER = 'toolkitmd';
export const GITHUB_REPO = 'LAIguide';
export const SESSION_KEY = 'lai_admin_session';

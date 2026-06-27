/**
 * Authentication service.
 *
 * Responsibilities:
 *  - Exchange credentials for a JWT via HTTP Basic auth (Base64 `identifier:password`).
 *  - Persist / read / clear the token in localStorage.
 *  - Decode the JWT payload natively (no external libraries) and validate it.
 */

import { ENDPOINTS, TOKEN_KEY } from '../config.js';

/**
 * Base64url-decode the middle segment of a JWT and parse it as JSON.
 * JWTs use base64url (`-`/`_` instead of `+`/`/`, no padding), so we normalise
 * before handing it to the native `atob()`.
 *
 * @param {string} token
 * @returns {object|null} decoded payload, or null if malformed
 */
export function parseJwt(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Restore the padding `atob` requires.
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);

    // Decode and correctly handle any UTF-8 / multi-byte characters.
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * A token is considered valid when it decodes cleanly, carries a subject
 * (the user id), and — if an `exp` claim is present — has not expired.
 *
 * @param {string|null} token
 * @returns {boolean}
 */
export function isTokenValid(token) {
  const payload = parseJwt(token);
  if (!payload) return false;

  // The `sub` claim holds the user id on the 01 platform.
  if (payload.sub == null) return false;

  if (typeof payload.exp === 'number') {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) return false;
  }
  return true;
}

/** @returns {string|null} the stored token, or null. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** @param {string} token */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the token — used by logout. */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** @returns {boolean} whether a logged-in, non-expired session exists. */
export function isAuthenticated() {
  return isTokenValid(getToken());
}

/**
 * Extract the user id from the currently stored token.
 * @returns {number|string|null}
 */
export function getUserId() {
  const payload = parseJwt(getToken());
  return payload ? payload.sub ?? null : null;
}

/**
 * Sign in with an identifier (username OR email) and password.
 * Credentials are combined as `identifier:password`, Base64-encoded with the
 * native `btoa()`, and sent as an HTTP Basic `Authorization` header.
 *
 * On success the returned JWT is stored and returned. On failure a descriptive
 * Error is thrown for the UI to display.
 *
 * @param {string} identifier
 * @param {string} password
 * @returns {Promise<string>} the JWT
 */
export async function signIn(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Please enter both your username/email and password.');
  }

  // `btoa` only handles Latin1; encode UTF-8 first so non-ASCII credentials
  // survive the round-trip.
  const raw = `${identifier}:${password}`;
  const basic = btoa(unescape(encodeURIComponent(raw)));

  let response;
  try {
    response = await fetch(ENDPOINTS.SIGNIN, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Network-level failure (offline, DNS, CORS, ...).
    throw new Error('Network error — could not reach the server. Check your connection.');
  }

  if (!response.ok) {
    // The API returns 401/403 with a JSON or text body on bad credentials.
    let message = 'Invalid username or password. Please try again.';
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') message = body.error;
      else if (typeof body === 'string') message = body;
    } catch {
      /* keep the default message */
    }
    if (response.status >= 500) {
      message = 'The server is having trouble right now. Please try again later.';
    }
    throw new Error(message);
  }

  // The signin endpoint returns the raw JWT, usually as a quoted JSON string.
  let token;
  try {
    token = await response.json();
  } catch {
    token = (await response.text()).trim();
  }
  if (typeof token !== 'string') token = String(token);
  token = token.replace(/^"|"$/g, '').trim();

  if (!isTokenValid(token)) {
    throw new Error('Received an invalid token from the server. Please try again.');
  }

  setToken(token);
  return token;
}

/** Clear the session. The router/UI is responsible for re-rendering. */
export function logout() {
  clearToken();
}

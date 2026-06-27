/**
 * GraphQL data layer.
 *
 * Exposes a single `fetchProfileData()` that runs ONE unified query and reshapes
 * the response into the model the dashboard renders from. Every request carries
 * the `Authorization: Bearer <JWT>` header.
 */

import { ENDPOINTS } from '../config.js';
import { getToken, clearToken } from './auth.js';
import { projectName, activityName } from '../utils.js';

/**
 * A single unified GraphQL query covering every required structural feature:
 *   - Normal fields ............ user { id, login }
 *   - Nested fields ............ transaction { amount, type, createdAt, path }
 *                                progress { ..., object { name, type } }
 *   - Arguments / filtering .... transaction where type _in [xp, up, down]
 *                                progress where object.type _eq "project"
 *
 * Note on profile fields: `email`, `country`, `CPR` and `degree` are read from
 * the user's `attrs` blob rather than as dedicated columns. Querying a column
 * that a given instance doesn't expose would fail the WHOLE query, so we only
 * request the guaranteed `attrs` jsonb and extract from it defensively. If your
 * instance exposes a top-level `email` column, add it to the `user` block.
 */
const PROFILE_QUERY = `
  query ProfileDashboard {
    user {
      id
      login
      attrs
    }
    transaction(
      where: { type: { _in: ["xp", "up", "down"] } }
      order_by: { createdAt: asc }
    ) {
      amount
      type
      createdAt
      path
    }
    progress(
      where: { object: { type: { _eq: "project" } } }
      order_by: { createdAt: asc }
    ) {
      id
      grade
      createdAt
      path
      object {
        id
        name
        type
      }
    }
  }
`;

/**
 * Low-level GraphQL POST helper with defensive error handling.
 *
 * @param {string} query
 * @param {object} [variables]
 * @returns {Promise<object>} the `data` object from the GraphQL response
 */
async function gqlRequest(query, variables = {}) {
  const token = getToken();
  if (!token) throw new Error('You are not signed in.');

  let response;
  try {
    response = await fetch(ENDPOINTS.GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Network error — could not reach the data server.');
  }

  // An expired / revoked token surfaces as 401; force a re-login.
  if (response.status === 401 || response.status === 403) {
    clearToken();
    throw new Error('Your session has expired. Please sign in again.');
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (json.errors && json.errors.length) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new Error(msg || 'The data query failed.');
  }
  if (!json.data) {
    throw new Error('No data was returned by the server.');
  }
  return json.data;
}

/** Reduce a list of transactions to the sum of their amounts. */
function sumAmount(transactions) {
  return transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

/**
 * Collapse repeated attempts of the same project into one row, preferring a
 * passing attempt, then the most recent. Prevents a fail-then-pass (two rows
 * for the same project) from being counted twice.
 *
 * Keyed on the object identity first — a retry keeps the same `object.id` even
 * if its `path` or `createdAt` differs — then falls back to path / name.
 */
function dedupeProgress(progress) {
  const byKey = new Map();
  for (const p of progress) {
    const key = (p.object && p.object.id) || p.path || projectName(p);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, p);
      continue;
    }
    const prevGrade = Number(prev.grade) || 0;
    const curGrade = Number(p.grade) || 0;
    const newer = new Date(p.createdAt) > new Date(prev.createdAt);
    if (curGrade > prevGrade || (curGrade === prevGrade && newer)) byKey.set(key, p);
  }
  return [...byKey.values()];
}

/** grade >= 1 -> PASS, graded but < 1 -> FAIL, ungraded -> IN_PROGRESS. */
function gradeStatus(grade) {
  if (grade == null) return 'IN_PROGRESS';
  return Number(grade) >= 1 ? 'PASS' : 'FAIL';
}

/**
 * Run the unified query and derive the dashboard view-model.
 * Every derived field is defended against missing / malformed data.
 *
 * @returns {Promise<object>}
 */
export async function fetchProfileData() {
  const data = await gqlRequest(PROFILE_QUERY);

  const user = data.user[0];
  const attrs = user.attrs;
  const transactions = Array.isArray(data.transaction) ? data.transaction : [];
  const progress = Array.isArray(data.progress) ? data.progress : [];
console.log(data)
  // --- Expanded profile (5 fields) ------
  const profile = {
    login: user.login ,
    email: attrs.email,
    country: attrs.country,
    cpr: attrs.CPRnumber,
    degree: attrs.Degree,
  };

  // --- Split transactions by type -----------------------------------------
  const xpTransactions = transactions.filter((t) => t.type === 'xp');
  const auditUp = sumAmount(transactions.filter((t) => t.type === 'up'));
  const auditDown = sumAmount(transactions.filter((t) => t.type === 'down'));
  const auditRatio = auditDown > 0 ? auditUp / auditDown : auditUp > 0 ? Infinity : 0;

  const totalXp = sumAmount(xpTransactions);

  // --- Every distinct activity, for the filter dropdown -------------------
  // An activity is the "/bahrain/<activity>/..." path segment (e.g. bh-module).
  const activities = [...new Set(xpTransactions.map((t) => activityName(t.path)).filter(Boolean))].sort();

  // --- Attempted projects (deduped) ---------------------------------------
  const unique = dedupeProgress(progress);
  const attemptedProjects = unique
    .map((p) => ({
      name: projectName(p),
      status: gradeStatus(p.grade),
      grade: p.grade,
      path: p.path,
      createdAt: p.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalAttempted = attemptedProjects.length;
  const totalPassed = attemptedProjects.filter((p) => p.status === 'PASS').length;

  return {
    user,
    profile,
    xpTransactions,
    totalXp,
    activities,
    auditUp,
    auditDown,
    auditRatio,
    attemptedProjects,
    totalAttempted,
    totalPassed,
  };
}

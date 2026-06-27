/**
 * Pure, framework-free utilities: formatting, path parsing and data shaping.
 * Kept side-effect free so they're trivial to reason about and reuse.
 */

/** Format an XP/byte amount into a compact human string. */
export function formatXp(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + ' MB';
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + ' kB';
  return Math.round(v) + ' B';
}

/** "Jun 26" — compact axis label. */
export function formatMonthYear(date) {
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

/** "27 Jun 2026" — readable ledger date. */
export function formatDay(date) {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Ratio to 2 decimals, or ∞ when the denominator is zero. */
export function formatRatio(ratio) {
  if (!Number.isFinite(ratio)) return '∞';
  return ratio.toFixed(2);
}

/**
 * Extract the "activity" from a transaction path. Paths look like
 * "/bahrain/<activity>/..." — the activity is the segment immediately after the
 * leading campus segment. Falls back to the first segment for any path that
 * doesn't follow that shape, so nothing is silently dropped.
 *   "/bahrain/bh-module/go-reloaded"             -> "bh-module"
 *   "/bahrain/bh-piscine/quest-01/introduction"  -> "bh-piscine"
 */
export function activityName(path) {
  const segs = (path || '').split('/').filter(Boolean);
  if (!segs.length) return '';
  if (segs[0] === 'bahrain') return segs[1] || '';
  return segs[0];
}

/** Last path segment — used as a fallback project name. */
export function lastSegment(path) {
  if (!path) return '';
  const segs = path.split('/').filter(Boolean);
  return segs[segs.length - 1] || '';
}

/** Best-effort project name: nested object name first, else path tail. */
export function projectName(row) {
  return (row && row.object && row.object.name) || lastSegment(row && row.path) || 'Unknown';
}

/**
 * Safely read the `attrs` blob, whether it arrives as a parsed object or a
 * JSON string. Always returns an object so `attrs.cpr` style access is safe.
 */
// export function safeAttrs(user) {
//   const a = user && user.attrs;
//   if (!a) return {};
//   if (typeof a === 'object') return a;
//   if (typeof a === 'string') {
//     try {
//       return JSON.parse(a) || {};
//     } catch {
//       return {};
//     }
//   }
//   return {};
// }

/**
 * Sort transactions chronologically and produce a running cumulative series.
 * @returns {Array<{date: Date, value: number, cumulative: number, path: string}>}
 */
export function cumulativeSeries(transactions) {
  let running = 0;
  return transactions
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((t) => {
      running += Number(t.amount) || 0;
      return {
        date: new Date(t.createdAt),
        value: Number(t.amount) || 0,
        cumulative: running,
        path: t.path,
      };
    });
}

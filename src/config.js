/**
 * Central configuration.
 *
 * The platform domain is the ONLY value you should need to change to point this
 * dashboard at your own instance. The original spec used a `((DOMAIN))`
 * placeholder — set it here once and every endpoint is derived from it.
 *
 * Examples: 'learn.reboot01.com', '01.kood.tech', 'learn.zone01oujda.ma', ...
 */
export const DOMAIN = 'learn.reboot01.com';

export const ENDPOINTS = Object.freeze({
  SIGNIN: `https://${DOMAIN}/api/auth/signin`,
  GRAPHQL: `https://${DOMAIN}/api/graphql-engine/v1/graphql`,
});

/** localStorage key under which the JWT is persisted. */
export const TOKEN_KEY = 'profile_dashboard_jwt';

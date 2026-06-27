/**
 * Top-level views: the tiny state store, the Login screen and the Dashboard
 * composition. Section-level rendering is delegated to ./sections.js and the
 * interactive XP block to ./xp.js.
 */

import { el } from './dom.js';
import {
  renderProfileCard,
  renderMetrics,
  renderProjectsPanel,
  renderAuditPanel,
} from './sections.js';
import { renderXpSection } from './xp.js';

/* ------------------------------------------------------------------------ *
 * Lightweight state management
 * ------------------------------------------------------------------------ */

export function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ------------------------------------------------------------------------ *
 * Login view
 * ------------------------------------------------------------------------ */

export function renderLogin({ onSubmit, loading = false, error = null }) {
  const form = el('form', { class: 'auth__form', novalidate: 'true' });
  form.append(field('identifier', 'Username or email', 'text', 'username'));
  form.append(field('password', 'Password', 'password', 'current-password'));

  const errorBox = el('p', { class: 'auth__error', role: 'alert', text: error || '' });
  errorBox.hidden = !error;
  form.append(errorBox);

  const submit = el('button', {
    type: 'submit',
    class: 'btn btn--primary auth__submit',
    text: loading ? 'Signing in…' : 'Sign in',
  });
  submit.disabled = loading;
  form.append(submit);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const identifier = form.elements.namedItem('identifier').value.trim();
    const password = form.elements.namedItem('password').value;
    onSubmit(identifier, password);
  });

  return el('section', { class: 'auth', 'aria-labelledby': 'auth-title' }, [
    el('div', { class: 'auth__card' }, [
      el('h1', { id: 'auth-title', class: 'auth__title', text: 'Welcome back' }),
      el('p', { class: 'auth__subtitle', text: 'Sign in to view your profile dashboard.' }),
      form,
    ]),
  ]);
}

function field(name, labelText, type, autocomplete) {
  const input = el('input', {
    class: 'field__input',
    id: `field-${name}`,
    name,
    type,
    autocomplete,
    required: 'true',
  });
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: `field-${name}`, text: labelText }),
    input,
  ]);
}

/* ------------------------------------------------------------------------ *
 * Dashboard view
 * ------------------------------------------------------------------------ */

export function renderDashboard({ data, loading, error, onLogout, onRetry }) {
  const root = el('div', { class: 'dashboard' });

  // Header
  const brand = el('div', { class: 'brand' }, [
    el('h1', { class: 'brand__title', text: 'Profile Dashboard' }),
  ]);
  if (data && data.profile) {
    brand.append(el('p', { class: 'brand__user', text: `@${data.profile.login}` }));
  }
  const logoutBtn = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Log out' });
  logoutBtn.addEventListener('click', onLogout);
  root.append(el('header', { class: 'dashboard__header' }, [brand, logoutBtn]));

  // States
  if (loading) {
    root.append(stateBlock('Loading your data…', 'loading'));
    return root;
  }
  if (error) {
    const block = stateBlock(error, 'error');
    const retry = el('button', { type: 'button', class: 'btn btn--primary', text: 'Try again' });
    retry.addEventListener('click', onRetry);
    block.append(retry);
    root.append(block);
    return root;
  }
  if (!data) return root;

  // Content
  root.append(renderProfileCard(data.profile));
  root.append(renderMetrics(data));
  root.append(renderXpSection(data));
  root.append(
    el('div', { class: 'grid-2' }, [renderProjectsPanel(data), renderAuditPanel(data)])
  );

  return root;
}

function stateBlock(message, kind) {
  return el(
    'div',
    { class: `state-block state-block--${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    [el('p', { text: message })]
  );
}

/**
 * Application entry point / router.
 *
 * Holds the single source of truth (a tiny store) and decides which view to
 * mount based on authentication state. All side-effects (network, storage)
 * flow through the auth + api services.
 */

import './style.css';
import { isAuthenticated, signIn, logout } from './services/auth.js';
import { fetchProfileData } from './services/api.js';
import { createStore, renderLogin, renderDashboard } from './components/ui.js';

const root = document.getElementById('app');

const store = createStore({
  view: isAuthenticated() ? 'dashboard' : 'login',
  authLoading: false,
  authError: null,
  dataLoading: false,
  dataError: null,
  data: null,
});

/* ------------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------------ */

async function handleSignIn(identifier, password) {
  store.setState({ authLoading: true, authError: null });
  try {
    await signIn(identifier, password);
    store.setState({ authLoading: false, view: 'dashboard' });
    loadDashboardData();
  } catch (err) {
    store.setState({ authLoading: false, authError: err.message });
  }
}

function handleLogout() {
  logout();
  store.setState({
    view: 'login',
    data: null,
    dataError: null,
    authError: null,
  });
}

async function loadDashboardData() {
  store.setState({ dataLoading: true, dataError: null });
  try {
    const data = await fetchProfileData();
    store.setState({ dataLoading: false, data });
  } catch (err) {
    // A session-expiry error from the api layer also clears the token.
    if (!isAuthenticated()) {
      store.setState({ view: 'login', authError: err.message, dataLoading: false });
    } else {
      store.setState({ dataLoading: false, dataError: err.message });
    }
  }
}

/* ------------------------------------------------------------------------ *
 * Render loop
 * ------------------------------------------------------------------------ */

function render(state) {
  root.replaceChildren();

  if (state.view === 'login') {
    root.appendChild(
      renderLogin({
        onSubmit: handleSignIn,
        loading: state.authLoading,
        error: state.authError,
      })
    );
    return;
  }

  root.appendChild(
    renderDashboard({
      data: state.data,
      loading: state.dataLoading,
      error: state.dataError,
      onLogout: handleLogout,
      onRetry: loadDashboardData,
    })
  );
}

store.subscribe(render);
render(store.getState());

// Kick off the initial data load if we resumed an authenticated session.
if (store.getState().view === 'dashboard') {
  loadDashboardData();
}
